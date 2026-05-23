"use client";
import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import {
  ShieldAlert, AlertTriangle, Zap, Cpu, User, Shield, Bug, Wrench, ArrowRight,
  BrainCircuit, CheckCircle2, XCircle, ChevronDown, ChevronUp, Clock, RefreshCw,
  ExternalLink, CheckCheck, Loader,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";

// ── Types ────────────────────────────────────────────────────────────────────
interface Blockage {
  id: string;
  type: string;
  status: "open" | "in_progress" | "resolved" | "wont_fix";
  title: string;
  description: string;
  instructions: string | null;
  created_by_agent: string | null;
  assigned_to_human: string | null;
  assigned_username: string | null;
  work_id: string | null;
  human_task_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  last_followup_at: string | null;
  followup_count: number;
  created_at: string;
  updated_at: string;
}

// ── Config maps ───────────────────────────────────────────────────────────────
const STATUS_ACCENT: Record<string, string> = {
  open:        "#f59e0b",
  in_progress: "#38bdf8",
  resolved:    "#22c55e",
  wont_fix:    "#475569",
};

const STATUS_LABEL: Record<string, string> = {
  open:        "Open",
  in_progress: "In Progress",
  resolved:    "Resolved",
  wont_fix:    "Won't Fix",
};

const TYPE_ICON: Record<string, React.FC<{ size?: number; color?: string }>> = {
  api_key_needed:       Zap,
  integration_missing:  Cpu,
  human_action:         User,
  permission_needed:    Shield,
  bug:                  Bug,
  tool_missing:         Wrench,
  external_dependency:  ArrowRight,
  waiting_on_decision:  BrainCircuit,
};

const TYPE_LABEL: Record<string, string> = {
  api_key_needed:       "API KEY NEEDED",
  integration_missing:  "INTEGRATION MISSING",
  human_action:         "HUMAN ACTION",
  permission_needed:    "PERMISSION NEEDED",
  bug:                  "BUG",
  tool_missing:         "TOOL MISSING",
  external_dependency:  "EXTERNAL DEPENDENCY",
  waiting_on_decision:  "WAITING ON DECISION",
};

const ALL_TYPES = [
  "api_key_needed", "integration_missing", "human_action",
  "permission_needed", "bug", "tool_missing", "external_dependency",
  "waiting_on_decision",
];

const ALL_STATUSES = ["all", "open", "in_progress", "resolved", "wont_fix"] as const;

// ── Utilities ─────────────────────────────────────────────────────────────────
function ageLabel(created_at: string): { text: string; urgent: boolean } {
  const diffMs = Date.now() - new Date(created_at).getTime();
  const diffH  = Math.floor(diffMs / (1000 * 60 * 60));
  const diffD  = Math.floor(diffH / 24);
  const urgent = diffH > 72;
  if (diffD >= 1) return { text: `${diffD}d open`, urgent };
  return { text: `${diffH}h open`, urgent };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Resolve input inline component ───────────────────────────────────────────
function ResolveInline({ onConfirm, onCancel }: {
  onConfirm: (notes: string) => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState("");
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}
    >
      <div style={{
        marginTop: "0.75rem", padding: "10px 12px", borderRadius: 8,
        background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)",
        display: "flex", flexDirection: "column", gap: "0.5rem",
      }}>
        <p style={{ fontSize: "10px", fontWeight: 800, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
          Resolution Notes
        </p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Describe what was done to resolve this blockage…"
          rows={2}
          style={{
            width: "100%", resize: "vertical", background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7,
            color: "#e2e8f0", fontSize: "12px", padding: "7px 10px",
            fontFamily: "inherit", outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <motion.button
            onClick={() => onConfirm(notes.trim())}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            style={{
              padding: "4px 12px", borderRadius: 6, fontSize: "11px", fontWeight: 700,
              background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)",
              color: "#22c55e", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            <CheckCheck size={11} /> Confirm Resolve
          </motion.button>
          <button
            onClick={onCancel}
            style={{
              padding: "4px 10px", borderRadius: 6, fontSize: "11px",
              background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
              color: "#475569", cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Blockage card ─────────────────────────────────────────────────────────────
function BlockageCard({ item, onUpdate }: {
  item: Blockage;
  onUpdate: (id: string, patch: Partial<Blockage>) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [patching, setPatching] = useState(false);

  const accent    = STATUS_ACCENT[item.status] ?? "#64748b";
  const TypeIcon  = TYPE_ICON[item.type] ?? AlertTriangle;
  const typeLabel = TYPE_LABEL[item.type] ?? item.type.replace(/_/g, " ").toUpperCase();
  const age       = item.status === "open" ? ageLabel(item.created_at) : null;
  const isActive  = item.status === "open" || item.status === "in_progress";

  const patch = async (body: Partial<Blockage>) => {
    setPatching(true);
    try {
      await onUpdate(item.id, body);
    } finally {
      setPatching(false);
    }
  };

  const handleResolveConfirm = async (notes: string) => {
    setShowResolve(false);
    await patch({ status: "resolved", resolved_by: "ash", resolution_notes: notes || undefined } as any);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        borderRadius: 10, marginBottom: "0.6rem", overflow: "hidden",
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderLeft: `3px solid ${accent}`,
      }}
    >
      {/* Card header row */}
      <div
        onClick={() => { setExpanded(e => !e); setShowResolve(false); }}
        style={{
          padding: "11px 14px", display: "flex", alignItems: "center",
          gap: "0.55rem", cursor: "pointer",
        }}
      >
        {/* Type icon */}
        <div style={{
          width: 26, height: 26, borderRadius: 7, flexShrink: 0,
          background: `${accent}18`, border: `1px solid ${accent}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <TypeIcon size={12} color={accent} />
        </div>

        {/* Type badge */}
        <span style={{
          fontSize: "9px", fontWeight: 800, letterSpacing: "0.07em",
          color: accent, background: `${accent}14`, border: `1px solid ${accent}28`,
          borderRadius: 10, padding: "1px 7px", whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {typeLabel}
        </span>

        {/* Agent tag */}
        {item.created_by_agent && (
          <span style={{
            fontSize: "9px", color: "#64748b", background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
            padding: "1px 6px", whiteSpace: "nowrap", flexShrink: 0,
          }}>
            {item.created_by_agent}
          </span>
        )}

        {/* Title */}
        <span style={{
          flex: 1, fontSize: "0.88rem", fontWeight: 700, color: "#e2e8f0",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {item.title}
        </span>

        {/* Followup badge */}
        {item.followup_count > 0 && (
          <span title={`${item.followup_count} reminder${item.followup_count !== 1 ? "s" : ""} sent`} style={{
            fontSize: "9px", fontWeight: 800, color: "#f59e0b",
            background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.28)",
            borderRadius: 8, padding: "1px 6px", whiteSpace: "nowrap", flexShrink: 0,
          }}>
            {item.followup_count} reminders
          </span>
        )}

        {/* Age */}
        {age && (
          <span style={{
            fontSize: "9px", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
            color: age.urgent ? "#f43f5e" : "#64748b",
            display: "flex", alignItems: "center", gap: 3,
          }}>
            <Clock size={9} />
            {age.text}
          </span>
        )}

        {/* Patching spinner */}
        {patching && <Loader size={12} color="#64748b" className="spin" />}

        {/* Expand toggle */}
        {expanded
          ? <ChevronUp size={13} color="#475569" style={{ flexShrink: 0 }} />
          : <ChevronDown size={13} color="#475569" style={{ flexShrink: 0 }} />
        }
      </div>

      {/* Description preview (always shown, 2-line clamp) */}
      {!expanded && item.description && (
        <p style={{
          fontSize: "0.8rem", color: "#64748b", margin: "0 14px 10px",
          lineHeight: 1.5, display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {item.description}
        </p>
      )}

      {/* Expanded body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 14px 12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              {/* Full description */}
              {item.description && (
                <p style={{ fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.6, marginTop: "0.6rem" }}>
                  {item.description}
                </p>
              )}

              {/* Instructions */}
              {item.instructions && (
                <div style={{
                  marginTop: "0.6rem", padding: "10px 12px", borderRadius: 8,
                  background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.15)",
                }}>
                  <p style={{ fontSize: "10px", fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 4px" }}>
                    Instructions
                  </p>
                  <p style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                    {item.instructions}
                  </p>
                </div>
              )}

              {/* Resolution info */}
              {item.status === "resolved" && (
                <div style={{
                  marginTop: "0.6rem", padding: "10px 12px", borderRadius: 8,
                  background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <CheckCircle2 size={11} color="#22c55e" />
                    <span style={{ fontSize: "10px", fontWeight: 800, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      Resolved
                    </span>
                    {item.resolved_by && (
                      <span style={{ fontSize: "10px", color: "#475569" }}>by {item.resolved_by}</span>
                    )}
                    {item.resolved_at && (
                      <span style={{ fontSize: "10px", color: "#374151" }}>· {fmtDate(item.resolved_at)}</span>
                    )}
                  </div>
                  {item.resolution_notes && (
                    <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                      {item.resolution_notes}
                    </p>
                  )}
                </div>
              )}

              {/* Won't fix note */}
              {item.status === "wont_fix" && (
                <div style={{
                  marginTop: "0.6rem", padding: "8px 12px", borderRadius: 8,
                  background: "rgba(71,85,105,0.12)", border: "1px solid rgba(71,85,105,0.25)",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <XCircle size={11} color="#475569" />
                  <span style={{ fontSize: "11px", color: "#475569" }}>Marked as Won't Fix</span>
                  {item.resolved_by && <span style={{ fontSize: "10px", color: "#374151" }}>by {item.resolved_by}</span>}
                </div>
              )}

              {/* Resolve inline input */}
              <AnimatePresence>
                {showResolve && (
                  <ResolveInline
                    onConfirm={handleResolveConfirm}
                    onCancel={() => setShowResolve(false)}
                  />
                )}
              </AnimatePresence>

              {/* Actions */}
              {isActive && (
                <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                  {/* In Progress */}
                  {item.status !== "in_progress" && (
                    <motion.button
                      onClick={() => patch({ status: "in_progress" } as any)}
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      disabled={patching}
                      style={{
                        padding: "4px 11px", borderRadius: 6, fontSize: "11px", fontWeight: 700,
                        background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.28)",
                        color: "#38bdf8", cursor: patching ? "not-allowed" : "pointer",
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}
                    >
                      <Loader size={10} /> In Progress
                    </motion.button>
                  )}

                  {/* Resolve */}
                  {!showResolve && (
                    <motion.button
                      onClick={() => setShowResolve(true)}
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      disabled={patching}
                      style={{
                        padding: "4px 11px", borderRadius: 6, fontSize: "11px", fontWeight: 700,
                        background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.28)",
                        color: "#22c55e", cursor: patching ? "not-allowed" : "pointer",
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}
                    >
                      <CheckCircle2 size={10} /> Resolve
                    </motion.button>
                  )}

                  {/* Won't Fix */}
                  <motion.button
                    onClick={() => patch({ status: "wont_fix" } as any)}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    disabled={patching}
                    style={{
                      padding: "4px 11px", borderRadius: 6, fontSize: "11px", fontWeight: 700,
                      background: "rgba(71,85,105,0.1)", border: "1px solid rgba(71,85,105,0.25)",
                      color: "#475569", cursor: patching ? "not-allowed" : "pointer",
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}
                  >
                    <XCircle size={10} /> Won't Fix
                  </motion.button>

                  {/* View Work */}
                  {item.work_id && (
                    <a
                      href={`/work?highlight=${item.work_id}`}
                      style={{
                        padding: "4px 11px", borderRadius: 6, fontSize: "11px", fontWeight: 700,
                        background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)",
                        color: "#a78bfa", display: "inline-flex", alignItems: "center", gap: 4,
                        textDecoration: "none",
                      }}
                    >
                      <ExternalLink size={10} /> View Work
                    </a>
                  )}

                  {/* View Task */}
                  {item.human_task_id && (
                    <a
                      href={`/work?highlight=${item.human_task_id}`}
                      style={{
                        padding: "4px 11px", borderRadius: 6, fontSize: "11px", fontWeight: 700,
                        background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)",
                        color: "#fb923c", display: "inline-flex", alignItems: "center", gap: 4,
                        textDecoration: "none",
                      }}
                    >
                      <ExternalLink size={10} /> View Task
                    </a>
                  )}
                </div>
              )}

              {/* Created at meta */}
              <p style={{ fontSize: "10px", color: "#374151", marginTop: "0.6rem", margin: "0.6rem 0 0" }}>
                Created {fmtDate(item.created_at)}
                {item.assigned_username && ` · Assigned to ${item.assigned_username}`}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ textAlign: "center", padding: "3.5rem 1rem" }}
    >
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        style={{ display: "inline-flex", marginBottom: "1rem" }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <CheckCircle2 size={28} color="#22c55e" />
        </div>
      </motion.div>
      <p style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0", margin: "0 0 4px" }}>
        {filtered ? "No blockages match this filter" : "No open blockages — agents are unblocked 🎉"}
      </p>
      <p style={{ fontSize: "0.82rem", color: "#475569", margin: 0 }}>
        {filtered ? "Try a different status or type filter." : "All systems are clear. Great work!"}
      </p>
    </motion.div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.4rem",
      background: `${color}10`, border: `1px solid ${color}28`,
      borderRadius: 20, padding: "4px 12px",
    }}>
      <span style={{ fontSize: "10px", fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </span>
      <span style={{ fontSize: "15px", fontWeight: 900, color, fontVariantNumeric: "tabular-nums" }}>
        {count}
      </span>
    </div>
  );
}

// ── Main page inner ──────────────────────────────────────────────────────────
function BlockagesPageInner() {
  const [blockages, setBlockages] = useState<Blockage[]>([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [typeFilter, setTypeFilter]     = useState<string>("all");
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchBlockages = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/blockages?status=all&limit=200`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const data: Blockage[] = await res.json();
        setBlockages(data);
      }
    } catch (err: any) {
      // Capture error but don't crash — list stays as-is
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlockages();
    autoRefreshRef.current = setInterval(fetchBlockages, 60_000);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [fetchBlockages]);

  // ── Patch ──────────────────────────────────────────────────────────────────
  const patchBlockage = useCallback(async (id: string, patch: Partial<Blockage>) => {
    const res = await fetch(`${BOT_URL}/admin/blockages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`PATCH /admin/blockages/${id} failed (${res.status}): ${text}`);
    }
    const updated: Blockage = await res.json();
    setBlockages(prev => prev.map(b => b.id === id ? updated : b));
  }, []);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const stats = {
    open:        blockages.filter(b => b.status === "open").length,
    in_progress: blockages.filter(b => b.status === "in_progress").length,
    resolved:    blockages.filter(b =>
      b.status === "resolved" && b.resolved_at && new Date(b.resolved_at) >= todayStart
    ).length,
  };

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtered = blockages
    .filter(b => statusFilter === "all" || b.status === statusFilter)
    .filter(b => typeFilter === "all" || b.type === typeFilter)
    .sort((a, b) => {
      if (a.status === "resolved" && b.status === "resolved") {
        return new Date(b.resolved_at ?? b.updated_at).getTime() - new Date(a.resolved_at ?? a.updated_at).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="px-5 py-5" style={{ maxWidth: 920, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: "1.5rem" }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(245,158,11,0.14)", border: "1px solid rgba(245,158,11,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ShieldAlert size={18} color="#f59e0b" />
            </div>
            <div>
              <h1 style={{ fontWeight: 900, fontSize: "1.45rem", color: "#fff", margin: 0 }}>
                Blockages
              </h1>
              <p style={{ fontSize: "0.8rem", color: "#64748b", margin: 0 }}>
                What's blocking agents and what needs your action
              </p>
            </div>
          </div>

          {/* Refresh button */}
          <motion.button
            onClick={fetchBlockages}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, cursor: "pointer", color: "#64748b", fontSize: "11px",
            }}
          >
            <RefreshCw size={11} /> Refresh
          </motion.button>
        </div>

        {/* Stat pills */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
          <StatPill label="Open"         count={stats.open}        color="#f59e0b" />
          <StatPill label="In Progress"  count={stats.in_progress} color="#38bdf8" />
          <StatPill label="Resolved Today" count={stats.resolved}  color="#22c55e" />
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {/* Status tabs */}
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {ALL_STATUSES.map(s => {
            const label = s === "all" ? "All" : (STATUS_LABEL[s] ?? s);
            const accent = s === "all" ? "#64748b" : (STATUS_ACCENT[s] ?? "#64748b");
            const active = statusFilter === s;
            return (
              <button key={s} onClick={() => setStatusFilter(s)} style={{
                padding: "4px 12px", borderRadius: 20, fontSize: "11px", fontWeight: active ? 800 : 600,
                background: active ? `${accent}18` : "rgba(255,255,255,0.04)",
                border: active ? `1px solid ${accent}35` : "1px solid rgba(255,255,255,0.07)",
                color: active ? accent : "#475569", cursor: "pointer", transition: "all 0.12s",
              }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Type filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "10px", color: "#374151", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Type:
          </span>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "#94a3b8", fontSize: "11px", padding: "4px 10px",
              outline: "none", cursor: "pointer",
            }}
          >
            <option value="all">All types</option>
            {ALL_TYPES.map(t => (
              <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>
            ))}
          </select>
          {typeFilter !== "all" && (
            <button
              onClick={() => setTypeFilter("all")}
              style={{
                fontSize: "10px", color: "#475569", background: "none", border: "none",
                cursor: "pointer", padding: 0,
              }}
            >
              ✕ clear
            </button>
          )}
        </div>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#475569", padding: "2.5rem 0" }}>
          <Loader size={14} className="spin" color="#475569" />
          <span style={{ fontSize: "0.85rem" }}>Loading blockages…</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filtered={statusFilter !== "open" || typeFilter !== "all"} />
      ) : (
        <AnimatePresence mode="popLayout">
          {filtered.map(b => (
            <BlockageCard key={b.id} item={b} onUpdate={patchBlockage} />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
export default function BlockagesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#475569" }}>Loading…</div>}>
      <BlockagesPageInner />
    </Suspense>
  );
}
