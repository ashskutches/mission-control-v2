"use client";

/**
 * Research — a library with a launcher, not a queue.
 *
 * A task asks "is it done?". Research asks "what did we learn, and where can I read
 * it?". So this page leads with the answer and the deliverable, and treats run status
 * as secondary metadata. One-off actions stay at /work.
 *
 * Two things feed the list, unioned server-side by /admin/research:
 *   - agent_work rows with type='research' — tracked investigations, usually promoted
 *     off the insights board, scheduled and multi-run.
 *   - agent_jobs pipeline runs — launched from the composer here, one-shot and staged.
 * They execute differently but read identically, so the page does not distinguish them
 * except where the extra detail (stage progress, self-grade) only exists for one.
 *
 * The method the agents follow lives in gravity-claw/.claude/skills/deep-research/SKILL.md.
 * The confidence and grade fields rendered below are produced by that method — if you
 * change the report format there, change the parsers in routes/research.ts to match.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FlaskConical, Search, FileText, ExternalLink, RefreshCw, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle2, Loader2, Clock, Bot, Link2, XCircle, ShieldCheck, Layers,
  CornerDownRight,
} from "lucide-react";
import ResearchComposer, { type AgentDef } from "@/components/ResearchComposer";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

// Poll fast while something is running, slowly when the library is idle. A research
// pipeline takes minutes, so a 60s tick makes an active run look frozen.
const POLL_ACTIVE_MS = 8_000;
const POLL_IDLE_MS = 60_000;

interface Deliverable {
  id: string;
  title: string | null;
  url: string | null;
  doc_type: string | null;
  stage_index: number | null;
  created_at: string;
  last_updated_at: string | null;
}

interface Stage {
  index: number;
  name: string;
  status: "done" | "pending";
}

interface ResearchItem {
  id: string;
  origin: "work" | "job";
  title: string;
  description: string | null;
  question: string | null;
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
  confidence: string | null;
  grade: Record<string, number> | null;
  stages: Stage[] | null;
  deliverables: Deliverable[];
  /** Set when this run was launched with "Follow up" off another report. */
  source_job_id: string | null;
  source_title: string | null;
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
  blocked:   { color: "#f43f5e", icon: AlertTriangle, label: "Failed" },
  cancelled: { color: "#6b7280", icon: XCircle,       label: "Cancelled" },
};

const CONFIDENCE_META: Record<string, { color: string; label: string }> = {
  high:   { color: "#22c55e", label: "High confidence" },
  medium: { color: "#f59e0b", label: "Medium confidence" },
  low:    { color: "#f43f5e", label: "Low confidence" },
};

const GRADE_LABELS: Record<string, string> = {
  factual: "Factual", citations: "Citations", completeness: "Complete",
  independence: "Independent", efficiency: "Efficient",
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
};

const ACCENT = "#a78bfa";

const isActive = (s: string) => s === "running" || s === "pending";

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

/**
 * A deliverable is a link only when it has somewhere to go.
 *
 * These used to render `href={url ?? "#"}`, which produced a link to /research# —
 * indistinguishable from a working one until you clicked it, and it hid the actual
 * problem (the report address never made it onto the document row). A document with no
 * address is now visibly inert and says why on hover.
 */
function DocLink({ url, style, inertHint, children }: {
  url: string | null;
  style: React.CSSProperties;
  inertHint: string;
  children: React.ReactNode;
}) {
  if (url) {
    return <a href={url} target="_blank" rel="noopener noreferrer" style={style}>{children}</a>;
  }
  return (
    <span style={{ ...style, opacity: 0.45, cursor: "default" }} title={inertHint}>
      {children}
    </span>
  );
}

/**
 * The self-grade the agent gave its own report.
 *
 * Shown because a grade nobody reads is decoration. Anything under 0.6 is called out
 * in red — the method requires the agent to name those in its Limitations section, so
 * a red bar here means there is something specific to go read.
 */
function GradeStrip({ grade }: { grade: Record<string, number> }) {
  const entries = Object.entries(grade).filter(([, v]) => typeof v === "number");
  if (!entries.length) return null;

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
      {entries.map(([k, v]) => {
        const weak = v < 0.6;
        return (
          <div key={k} style={{ minWidth: 64 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: weak ? "#f43f5e" : "#94a3b8" }}>
                {v.toFixed(1)}
              </span>
              <span style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {GRADE_LABELS[k] ?? k}
              </span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", marginTop: 3 }}>
              <div style={{
                height: "100%", borderRadius: 2,
                width: `${Math.max(0, Math.min(1, v)) * 100}%`,
                background: weak ? "#f43f5e" : ACCENT,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Stage progress for a pipeline run — only meaningful while it is still going. */
function StageTrack({ stages }: { stages: Stage[] }) {
  const done = stages.filter(s => s.status === "done").length;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <Layers size={10} color="#64748b" />
        <span style={{ fontSize: 10, color: "#64748b" }}>
          Stage {Math.min(done + 1, stages.length)} of {stages.length}
          {stages[done] ? ` — ${stages[done].name}` : ""}
        </span>
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {stages.map(s => (
          <div
            key={s.index}
            title={s.name}
            style={{
              flex: 1, height: 3, borderRadius: 2,
              background: s.status === "done" ? ACCENT : "rgba(255,255,255,0.08)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ResearchCard({ item, onFollowUp }: {
  item: ResearchItem;
  /** Seeds the composer with this report. Absent for runs that produced nothing to build on. */
  onFollowUp: (item: ResearchItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[item.status] ?? STATUS_META.pending!;
  const StatusIcon = meta.icon;
  const running = item.status === "running";
  const conf = item.confidence ? CONFIDENCE_META[item.confidence] : null;

  // The final-stage document is what you want to open; earlier stages are working
  // notes the last stage compiled from. The server sorts them that way.
  const [primary, ...notes] = item.deliverables;

  return (
    <div style={{ ...card, padding: "16px 18px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7, background: `${meta.color}14`,
          border: `1px solid ${meta.color}33`, display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0, marginTop: 1,
        }}>
          <StatusIcon size={13} color={meta.color} className={running ? "spin" : ""} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", margin: 0, lineHeight: 1.4 }}>
            {item.title}
          </p>

          {/* Provenance for a follow-up. Shown above the question because it changes
              how you read the answer: these findings were built on top of another
              run's, and the chain is the thing you want to be able to walk back. */}
          {item.source_job_id && (
            <p style={{
              fontSize: 10, color: "#64748b", margin: "5px 0 0",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              <CornerDownRight size={10} color={ACCENT} />
              Follows up on{" "}
              <span style={{ color: "#94a3b8" }}>
                {item.source_title ?? "a previous run"}
              </span>
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: meta.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {meta.label}
            </span>
            {conf && (
              <span style={{
                fontSize: 9.5, fontWeight: 700, color: conf.color, textTransform: "uppercase",
                letterSpacing: "0.05em", padding: "2px 6px", borderRadius: 5,
                background: `${conf.color}14`, border: `1px solid ${conf.color}30`,
                display: "inline-flex", alignItems: "center", gap: 3,
              }}>
                <ShieldCheck size={9} /> {conf.label}
              </span>
            )}
            {item.agent_name && (
              <span style={{ fontSize: 10, color: "#64748b", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Bot size={10} /> {item.agent_name}
              </span>
            )}
            <span style={{ fontSize: 10, color: "#475569" }}>
              {new Date(item.created_at).toLocaleDateString()}
            </span>
            {(item.run_count ?? 0) > 1 && (
              <span style={{ fontSize: 10, color: "#475569" }}>{item.run_count} runs</span>
            )}
            {item.insight_id && (
              <a
                href={`/pipeline/${item.insight_id}`}
                style={{ fontSize: 10, color: ACCENT, display: "inline-flex", alignItems: "center", gap: 3, textDecoration: "none" }}
              >
                <Link2 size={10} /> from insight
              </a>
            )}
          </div>

          {/* Live stage progress — drops away once the run finishes. */}
          {running && item.stages && item.stages.length > 0 && <StageTrack stages={item.stages} />}

          {/* The answer — the reason this page exists. */}
          {item.summary && (
            <p style={{
              fontSize: 11.5, color: "#94a3b8", margin: "10px 0 0", lineHeight: 1.55,
              display: "-webkit-box", WebkitLineClamp: open ? 99 : 3, WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {item.summary}
            </p>
          )}

          {/* Deliverables */}
          {primary ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 11 }}>
              <DocLink
                url={primary.url}
                inertHint="No stored report for this run — it finished before reports were published, or the report upload failed."
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11,
                  fontWeight: 600, color: ACCENT, textDecoration: "none",
                  background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.22)",
                  borderRadius: 8, padding: "7px 10px", width: "fit-content", maxWidth: "100%",
                }}
              >
                <FileText size={12} style={{ flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {primary.title ?? "Untitled report"}
                </span>
                {primary.url && <ExternalLink size={10} style={{ flexShrink: 0, opacity: 0.7 }} />}
              </DocLink>

              {open && notes.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 2 }}>
                  <span style={{ fontSize: 9.5, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Working notes
                  </span>
                  {notes.map(d => (
                    <DocLink
                      key={d.id}
                      url={d.url}
                      inertHint="Working note kept in the database — its content was compiled into the report above."
                      style={{
                        fontSize: 10.5, color: "#64748b", textDecoration: "none",
                        display: "inline-flex", alignItems: "center", gap: 5,
                      }}
                    >
                      <FileText size={10} />
                      {d.stage_index != null ? `Stage ${d.stage_index} — ` : ""}{d.title ?? "Untitled"}
                    </DocLink>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 10.5, color: "#475569", fontStyle: "italic", margin: "10px 0 0" }}>
              {item.status === "done"
                ? "Completed without a linked deliverable."
                : item.status === "blocked"
                  ? "Run failed before producing a report."
                  : "No deliverable yet."}
            </p>
          )}

          {/* Ask the next question with this report already in hand.
              Only on finished pipeline runs: the server carries the report text into
              the new run's prompt, and it can only read that off an agent_jobs row.
              A work-origin item has no compiled report to hand over. */}
          {item.origin === "job" && item.status === "done" && (primary || item.summary) && (
            <button
              onClick={() => onFollowUp(item)}
              title="Start a new investigation with this report supplied as source material"
              style={{
                marginTop: 10, height: 26, padding: "0 10px", borderRadius: 7,
                display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
                background: "rgba(167,139,250,0.07)",
                border: "1px solid rgba(167,139,250,0.24)",
                color: ACCENT, fontSize: 10.5, fontWeight: 700,
              }}
            >
              <CornerDownRight size={11} /> Follow up
            </button>
          )}

          {/* Self-grade, expanded only — it is a quality check, not a headline. */}
          {open && item.grade && <GradeStrip grade={item.grade} />}

          {/* Plan, collapsed by default — this is process, not findings. */}
          {(() => {
            const steps = item.milestones ?? [];
            const hasExtra = steps.length > 0 || (item.grade && Object.keys(item.grade).length > 0) || notes.length > 0;
            if (!hasExtra) return null;
            return (
              <>
                <button
                  onClick={() => setOpen(o => !o)}
                  style={{
                    marginTop: 10, fontSize: 10, color: "#64748b", background: "none",
                    border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, padding: 0,
                  }}
                >
                  {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  {open ? "Hide" : "Show"} detail
                  {steps.length > 0 ? ` (${steps.length} steps)` : ""}
                </button>
                {open && steps.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    {steps.map((m, i) => {
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
            );
          })()}
        </div>
      </div>
    </div>
  );
}

export default function ResearchPage() {
  const [data, setData] = useState<ResearchResponse | null>(null);
  const [agents, setAgents] = useState<AgentDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");

  // Held in a ref so the polling effect can read the current cadence without
  // re-subscribing every time the data changes.
  const hasActive = useRef(false);

  // The report a new run should build on, when one was chosen with "Follow up".
  // Lifted to the page because the button lives on a card and the composer is at
  // the top — the two are far apart in the tree and nothing else connects them.
  const [followUp, setFollowUp] = useState<{ id: string; title: string } | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const startFollowUp = useCallback((item: ResearchItem) => {
    setFollowUp({ id: item.id, title: item.title });
    // The library is long and the composer is above the fold only on a short one.
    // Without this the button appears to do nothing.
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/research?limit=200`);
      if (!res.ok) throw new Error(`Research fetch failed: ${res.status}`);
      const json: ResearchResponse = await res.json();
      setData(json);
      hasActive.current = json.items.some(i => isActive(i.status));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetch(`${BOT_URL}/admin/agents`)
      .then(r => (r.ok ? r.json() : []))
      .then((a) => setAgents(Array.isArray(a) ? a : []))
      .catch(() => {});
  }, [fetchData]);

  // Self-rescheduling tick rather than a fixed interval, so the cadence can change
  // the moment a run starts or finishes instead of on the next slow tick.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      timer = setTimeout(async () => {
        if (cancelled) return;
        await fetchData(true);
        if (!cancelled) tick();
      }, hasActive.current ? POLL_ACTIVE_MS : POLL_IDLE_MS);
    };
    tick();

    return () => { cancelled = true; clearTimeout(timer); };
  }, [fetchData]);

  const agentOptions = useMemo(() => {
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
        [i.title, i.summary, i.description, i.question, i.agent_name, ...i.deliverables.map(d => d.title)]
          .filter(Boolean).some(f => String(f).toLowerCase().includes(q)),
      );
    }
    return items;
  }, [data, search, statusFilter, agentFilter]);

  const active = useMemo(() => visible.filter(i => isActive(i.status)), [visible]);
  const finished = useMemo(() => visible.filter(i => !isActive(i.status)), [visible]);

  return (
    <div style={{ padding: "22px 26px", maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 6 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, background: "rgba(167,139,250,0.1)",
          border: "1px solid rgba(167,139,250,0.25)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <FlaskConical size={15} color={ACCENT} />
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

      <div ref={composerRef}>
        <ResearchComposer
          agents={agents}
          followUp={followUp}
          onClearFollowUp={() => setFollowUp(null)}
          onLaunched={() => { setFollowUp(null); fetchData(true); }}
        />
      </div>

      {/* Counts */}
      {data && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <StatCard label="Total" value={data.total} color="#e2e8f0" />
          <StatCard label="With report" value={data.counts.withDeliverable} color={ACCENT} />
          <StatCard label="Active" value={data.counts.active} color="#38bdf8" />
          <StatCard label="Failed" value={data.counts.blocked} color="#f43f5e" />
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
            placeholder="Search answers and reports…"
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

        {agentOptions.length > 0 && (
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
            {agentOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
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
              ? "No research yet. Ask a question above to start the first investigation."
              : "No research matches these filters."}
          </p>
        </div>
      )}

      {/* In flight — pulled to the top so a running investigation is never buried
          under months of finished ones. */}
      {active.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
            In progress
          </p>
          {active.map(item => <ResearchCard key={item.id} item={item} onFollowUp={startFollowUp} />)}
        </div>
      )}

      {finished.length > 0 && (
        <>
          {active.length > 0 && (
            <p style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
              Library
            </p>
          )}
          {finished.map(item => <ResearchCard key={item.id} item={item} onFollowUp={startFollowUp} />)}
        </>
      )}

      {/* Reports with no tracked research item — usually produced directly by a
          routine. Shown so the library is complete rather than quietly partial.
          Anything launched from this page carries provenance and never lands here. */}
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
              <DocLink
                key={d.id}
                url={d.url}
                inertHint="This document has no stored link — its text lives in the database only."
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
                {d.url && <ExternalLink size={10} color="#475569" style={{ flexShrink: 0 }} />}
              </DocLink>
            ))}
          </div>
        </div>
      )}

      <style jsx global>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
