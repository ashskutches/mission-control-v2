"use client";

/**
 * WorkDetailDrawer
 * A slide-in right-side drawer showing full details for any agent work item,
 * human task, or agent task pending approval.
 *
 * Used from both /queue and /work pages.
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader,
  PlayCircle,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Cpu,
  ExternalLink,
  CircleDot,
  Flag,
  ZapOff,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";
const POLL_INTERVAL_MS = 8_000;
const OUTPUT_TRUNCATE_LEN = 600;

// ── Types ──────────────────────────────────────────────────────────────────────

export type ItemType = "work" | "task" | "agent_task";

type WorkStatus =
  | "pending"
  | "running"
  | "in_progress"
  | "blocked"
  | "failed"
  | "needs_human"
  | "done"
  | "cancelled";

type TaskStatus = "pending" | "in_progress" | "done" | "blocked" | "cancelled";
type AgentTaskStatus = "pending" | "approved" | "rejected" | "cancelled";
type EffortTier = "quick" | "moderate" | "involved" | "epic";

interface AgentWork {
  id: string;
  agent_id: string;
  agent_name: string | null;
  title: string;
  description: string | null;
  status: WorkStatus;
  priority: number;
  effort_tier: EffortTier | null;
  estimated_hours: number | null;
  last_progress: string | null;
  completion_report: string | null;
  milestones: { label: string; done?: boolean }[];
  current_milestone: number;
  run_count: number;
  max_runs: number;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

interface HumanTask {
  id: string;
  title: string;
  description: string | null;
  instructions: string;
  assigned_to: string;
  assigned_username: string | null;
  created_by_agent: string | null;
  status: TaskStatus;
  priority: number;
  effort_tier: EffortTier | null;
  estimated_hours: number | null;
  due_date: string | null;
  followup_count: number;
  completion_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentTask {
  id: string;
  agent_id: string;
  agent_name: string | null;
  section: string;
  title: string;
  body: string | null;          // plain-text description / context
  tool_name: string;            // the tool to be executed
  tool_input: Record<string, unknown>; // tool arguments
  assigned_to: string;
  status: AgentTaskStatus;
  priority: number;
  human_note: string | null;    // rejection/approval note from human
  result: string | null;        // execution result once run
  created_at: string;
  updated_at: string;
}

export interface WorkDetailDrawerProps {
  itemId: string | null;
  itemType: ItemType;
  onClose: () => void;
  onAction?: () => void;
}

// ── Status colour maps ────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  pending: "#64748b",
  running: "#38bdf8",
  in_progress: "#38bdf8",
  blocked: "#f43f5e",
  failed: "#f43f5e",
  needs_human: "#f59e0b",
  done: "#22c55e",
  cancelled: "#475569",
  approved: "#a78bfa",
  rejected: "#f43f5e",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  in_progress: "In Progress",
  blocked: "Blocked",
  failed: "Failed",
  needs_human: "Needs Human",
  done: "Done",
  cancelled: "Cancelled",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  pending: CircleDot,
  running: Loader,
  in_progress: Loader,
  blocked: ZapOff,
  failed: XCircle,
  needs_human: AlertTriangle,
  done: CheckCircle2,
  cancelled: XCircle,
  approved: CheckCircle2,
  rejected: XCircle,
};

const CARD_BG: Record<string, string> = {
  done: "rgba(34,197,94,0.04)",
  blocked: "rgba(244,63,94,0.04)",
  failed: "rgba(244,63,94,0.04)",
  running: "rgba(56,189,248,0.03)",
  in_progress: "rgba(56,189,248,0.03)",
  needs_human: "rgba(245,158,11,0.03)",
  approved: "rgba(167,139,250,0.04)",
  pending: "rgba(255,255,255,0.02)",
  cancelled: "rgba(255,255,255,0.01)",
};

const EFFORT_LABEL: Record<EffortTier, string> = {
  quick: "Quick",
  moderate: "Moderate",
  involved: "Involved",
  epic: "Epic",
};

const EFFORT_COLOR: Record<EffortTier, string> = {
  quick: "#22c55e",
  moderate: "#f59e0b",
  involved: "#f97316",
  epic: "#f43f5e",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(ts: string | null | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusColor(s: string): string {
  return STATUS_COLOR[s] ?? "#64748b";
}

function glowShadow(s: string): string {
  const c = statusColor(s);
  return `0 0 40px ${c}18, inset 0 0 0 1px rgba(255,255,255,0.04)`;
}

// ── Skeleton loader ────────────────────────────────────────────────────────────

function SkeletonLine({
  width = "100%",
  height = 14,
  mb = 8,
}: {
  width?: string | number;
  height?: number;
  mb?: number;
}) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
      style={{
        width,
        height,
        borderRadius: 6,
        background: "rgba(255,255,255,0.07)",
        marginBottom: mb,
      }}
    />
  );
}

function DrawerSkeleton() {
  return (
    <div style={{ padding: "1.5rem" }}>
      {/* Header band */}
      <SkeletonLine height={72} mb={24} />
      {/* Badges */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <SkeletonLine width={64} height={22} mb={0} />
        <SkeletonLine width={80} height={22} mb={0} />
        <SkeletonLine width={56} height={22} mb={0} />
      </div>
      {/* Output label */}
      <SkeletonLine width={160} height={10} mb={10} />
      <SkeletonLine height={90} mb={20} />
      {/* Milestones */}
      <SkeletonLine width={140} height={10} mb={10} />
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <SkeletonLine width={16} height={16} mb={0} />
          <SkeletonLine width={`${60 + i * 10}%`} height={14} mb={0} />
        </div>
      ))}
      <div style={{ marginTop: 24 }}>
        <SkeletonLine width={180} height={10} mb={14} />
        <div style={{ display: "flex", gap: 8 }}>
          <SkeletonLine width={100} height={34} mb={0} />
          <SkeletonLine width={80} height={34} mb={0} />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "#475569",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function Badge({
  label,
  color,
  bg,
}: {
  label: string;
  color: string;
  bg?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: 6,
        background: bg ?? `${color}18`,
        color,
        textTransform: "uppercase" as const,
        letterSpacing: "0.04em",
        border: `1px solid ${color}30`,
      }}
    >
      {label}
    </span>
  );
}

interface ActionBtnProps {
  onClick: () => void;
  disabled?: boolean;
  color: string;
  children: React.ReactNode;
  variant?: "solid" | "outline" | "ghost";
}

function ActionBtn({
  onClick,
  disabled,
  color,
  children,
  variant = "outline",
}: ActionBtnProps) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 16px",
    borderRadius: 8,
    fontSize: "0.8rem",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    transition: "background 0.15s, border-color 0.15s",
  };

  const styles: Record<string, React.CSSProperties> = {
    solid: {
      ...base,
      background: color,
      color: "#fff",
      border: "none",
    },
    outline: {
      ...base,
      background: `${color}12`,
      color,
      border: `1px solid ${color}35`,
    },
    ghost: {
      ...base,
      background: "transparent",
      color: "#64748b",
      border: "1px solid rgba(255,255,255,0.08)",
    },
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.03 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      style={styles[variant]}
    >
      {children}
    </motion.button>
  );
}

// ── MILESTONE TIMELINE ────────────────────────────────────────────────────────

interface MilestoneTimelineProps {
  milestones: { label: string; done?: boolean }[];
  currentMilestone: number;
}

function MilestoneTimeline({
  milestones,
  currentMilestone,
}: MilestoneTimelineProps) {
  if (!milestones || milestones.length === 0) return null;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <SectionLabel>
        Progress Timeline — {currentMilestone}/{milestones.length}
      </SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {milestones.map((m, i) => {
          const isDone = i < currentMilestone;
          const isCurrent = i === currentMilestone;

          const lineColor = isDone
            ? "#22c55e"
            : isCurrent
            ? "#38bdf8"
            : "rgba(255,255,255,0.06)";

          return (
            <div
              key={i}
              style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
            >
              {/* Dot + connector */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                {/* Dot */}
                {isDone ? (
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#22c55e",
                      border: "2px solid #22c55e",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 2,
                    }}
                  >
                    <CheckCheck size={10} color="#fff" />
                  </div>
                ) : isCurrent ? (
                  <motion.div
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ repeat: Infinity, duration: 1.4 }}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "rgba(56,189,248,0.2)",
                      border: "2px solid #38bdf8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 2,
                    }}
                  >
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#38bdf8",
                      }}
                    />
                  </motion.div>
                ) : (
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.04)",
                      border: "2px solid rgba(255,255,255,0.1)",
                      marginTop: 2,
                    }}
                  />
                )}
                {/* Connector line (not on last) */}
                {i < milestones.length - 1 && (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: 20,
                      background: lineColor,
                      borderRadius: 2,
                      marginTop: 2,
                      marginBottom: 2,
                      opacity: isDone ? 1 : 0.3,
                    }}
                  />
                )}
              </div>

              {/* Label */}
              <div style={{ paddingTop: 3, paddingBottom: i < milestones.length - 1 ? 18 : 0 }}>
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: isDone
                      ? "#22c55e"
                      : isCurrent
                      ? "#e2e8f0"
                      : "#475569",
                    fontWeight: isCurrent ? 700 : 500,
                    display: "inline",
                  }}
                >
                  {m.label}
                </span>
                {isCurrent && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#38bdf8",
                      background: "rgba(56,189,248,0.12)",
                      padding: "1px 6px",
                      borderRadius: 4,
                      border: "1px solid rgba(56,189,248,0.25)",
                    }}
                  >
                    ← current
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── HEADER BAND ───────────────────────────────────────────────────────────────

interface HeaderBandProps {
  status: string;
  title: string;
  agentOrAssignee: string | null;
  priority: number;
  effortTier: EffortTier | null;
}

function HeaderBand({
  status,
  title,
  agentOrAssignee,
  priority,
  effortTier,
}: HeaderBandProps) {
  const color = statusColor(status);
  const label = STATUS_LABEL[status] ?? status;
  const Icon = STATUS_ICON[status] ?? CircleDot;
  const isSpinning = status === "running" || status === "in_progress";

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${color}14 0%, ${color}06 100%)`,
        borderBottom: `1px solid ${color}25`,
        padding: "1.25rem 1.5rem 1rem",
      }}
    >
      {/* Status badge row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 8,
            background: `${color}20`,
            border: `1px solid ${color}35`,
            flexShrink: 0,
          }}
        >
          <Icon
            size={14}
            color={color}
            style={
              isSpinning ? { animation: "spin 2s linear infinite" } : undefined
            }
          />
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {label}
        </span>
      </div>

      {/* Title */}
      <h2
        style={{
          fontSize: "1.05rem",
          fontWeight: 800,
          color: "#e2e8f0",
          margin: "0 0 10px",
          lineHeight: 1.35,
        }}
      >
        {title}
      </h2>

      {/* Meta badges */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {agentOrAssignee && (
          <Badge
            label={agentOrAssignee}
            color="#94a3b8"
            bg="rgba(255,255,255,0.06)"
          />
        )}
        <Badge
          label={`P${priority}`}
          color={
            priority >= 8 ? "#f43f5e" : priority >= 6 ? "#f59e0b" : "#64748b"
          }
        />
        {effortTier && (
          <Badge
            label={EFFORT_LABEL[effortTier]}
            color={EFFORT_COLOR[effortTier]}
          />
        )}
      </div>
    </div>
  );
}

// ── AGENT WORK CONTENT ────────────────────────────────────────────────────────

interface AgentWorkContentProps {
  work: AgentWork;
  onClose: () => void;
  onAction?: () => void;
}

function AgentWorkContent({ work, onClose, onAction }: AgentWorkContentProps) {
  const [acting, setActing] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const milestones: { label: string; done?: boolean }[] = Array.isArray(
    work.milestones
  )
    ? work.milestones
    : [];

  const act = useCallback(
    async (status: WorkStatus) => {
      setActing(true);
      setError(null);
      try {
        const res = await fetch(`${BOT_URL}/admin/work/${work.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        onAction?.();
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Action failed");
      } finally {
        setActing(false);
      }
    },
    [work.id, onAction, onClose]
  );

  const isActive = work.status !== "done" && work.status !== "cancelled";
  const rawOutput = work.last_progress ?? "";
  const truncated = rawOutput.length > OUTPUT_TRUNCATE_LEN && !outputExpanded;
  const displayOutput = truncated
    ? rawOutput.slice(0, OUTPUT_TRUNCATE_LEN) + "…"
    : rawOutput;

  return (
    <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
      {/* Milestones */}
      {milestones.length > 0 && (
        <MilestoneTimeline
          milestones={milestones}
          currentMilestone={work.current_milestone ?? 0}
        />
      )}

      {/* Latest agent output */}
      <div style={{ marginBottom: "1.5rem" }}>
        <SectionLabel>Latest Agent Output</SectionLabel>
        {rawOutput ? (
          <>
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: "10px 12px",
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: "0.78rem",
                color: "#94a3b8",
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {displayOutput}
            </div>
            {rawOutput.length > OUTPUT_TRUNCATE_LEN && (
              <button
                onClick={() => setOutputExpanded((v) => !v)}
                style={{
                  marginTop: 6,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.75rem",
                  color: "#38bdf8",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {outputExpanded ? (
                  <>
                    <ChevronUp size={12} /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown size={12} /> Show more
                  </>
                )}
              </button>
            )}
          </>
        ) : (
          <p style={{ fontSize: "0.8rem", color: "#475569", fontStyle: "italic" }}>
            No output recorded yet.
          </p>
        )}
      </div>

      {/* Completion report */}
      {work.status === "done" && work.completion_report && (
        <div
          style={{
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.15)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#22c55e",
              marginBottom: 6,
            }}
          >
            Completion Report
          </div>
          <p
            style={{
              fontSize: "0.8rem",
              color: "#86efac",
              lineHeight: 1.65,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
            }}
          >
            {work.completion_report}
          </p>
        </div>
      )}

      {/* Blocked / Failed panel */}
      {(work.status === "blocked" || work.status === "failed") && (
        <div
          style={{
            background: "rgba(244,63,94,0.06)",
            border: "1px solid rgba(244,63,94,0.15)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#f43f5e",
              marginBottom: 6,
            }}
          >
            {work.status === "failed" ? "Failed" : "Blocked"}
          </div>
          <p
            style={{
              fontSize: "0.8rem",
              color: "#fca5a5",
              lineHeight: 1.65,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
            }}
          >
            {work.last_progress ?? "No error context available."}
          </p>
        </div>
      )}

      {/* Actions */}
      {isActive && (
        <div style={{ marginBottom: "1.5rem" }}>
          <SectionLabel>Actions</SectionLabel>
          {error && (
            <div
              style={{
                marginBottom: 10,
                padding: "7px 12px",
                borderRadius: 7,
                background: "rgba(244,63,94,0.08)",
                border: "1px solid rgba(244,63,94,0.2)",
                color: "#f43f5e",
                fontSize: "0.78rem",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <AlertTriangle size={12} /> {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ActionBtn
              onClick={() => act("done")}
              disabled={acting}
              color="#22c55e"
              variant="outline"
            >
              <CheckCircle2 size={13} /> Mark Done
            </ActionBtn>
            <ActionBtn
              onClick={() => act("cancelled")}
              disabled={acting}
              color="#475569"
              variant="ghost"
            >
              <XCircle size={13} /> Cancel
            </ActionBtn>
            <a
              href={`/chats?agent=${work.agent_id}&context=${encodeURIComponent(
                `[Work: ${work.title}] Tell me about this.`
              )}`}
              style={{
                marginLeft: "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 14px",
                borderRadius: 8,
                fontSize: "0.78rem",
                color: "#64748b",
                border: "1px solid rgba(255,255,255,0.07)",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              <ExternalLink size={11} /> Chat →
            </a>
          </div>
        </div>
      )}

      {/* Metadata footer */}
      <MetadataFooter
        createdAt={work.created_at}
        updatedAt={work.updated_at}
        nameLabel="Agent"
        name={work.agent_name}
        extra={`Run ${work.run_count} / max ${work.max_runs}`}
      />
    </div>
  );
}

// ── HUMAN TASK CONTENT ────────────────────────────────────────────────────────

interface HumanTaskContentProps {
  task: HumanTask;
  onClose: () => void;
  onAction?: () => void;
}

function HumanTaskContent({ task, onClose, onAction }: HumanTaskContentProps) {
  const [acting, setActing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setActing(true);
      setError(null);
      try {
        const res = await fetch(`${BOT_URL}/admin/work/human/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const bd = await res.json().catch(() => ({}));
          throw new Error(bd.error ?? `HTTP ${res.status}`);
        }
        onAction?.();
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Action failed");
      } finally {
        setActing(false);
      }
    },
    [task.id, onAction, onClose]
  );

  const isActive = task.status !== "done" && task.status !== "cancelled";

  return (
    <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
      {/* Instructions */}
      {task.instructions && (
        <div style={{ marginBottom: "1.5rem" }}>
          <SectionLabel>Instructions</SectionLabel>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: "0.8rem",
              color: "#94a3b8",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {task.instructions}
          </div>
        </div>
      )}

      {/* Description */}
      {task.description && (
        <div style={{ marginBottom: "1.5rem" }}>
          <SectionLabel>Description</SectionLabel>
          <p
            style={{
              fontSize: "0.83rem",
              color: "#94a3b8",
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            {task.description}
          </p>
        </div>
      )}

      {/* Completion notes (if done) */}
      {task.status === "done" && task.completion_notes && (
        <div
          style={{
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.15)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#22c55e",
              marginBottom: 6,
            }}
          >
            Completion Notes
          </div>
          <p
            style={{
              fontSize: "0.8rem",
              color: "#86efac",
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            {task.completion_notes}
          </p>
        </div>
      )}

      {/* Blocked panel */}
      {task.status === "blocked" && (
        <div
          style={{
            background: "rgba(244,63,94,0.06)",
            border: "1px solid rgba(244,63,94,0.15)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#f43f5e",
              marginBottom: 4,
            }}
          >
            Blocked
          </div>
          <p
            style={{
              fontSize: "0.8rem",
              color: "#fca5a5",
              margin: 0,
            }}
          >
            This task is currently blocked.
          </p>
        </div>
      )}

      {/* Actions */}
      {isActive && (
        <div style={{ marginBottom: "1.5rem" }}>
          <SectionLabel>Actions</SectionLabel>
          {error && (
            <div
              style={{
                marginBottom: 10,
                padding: "7px 12px",
                borderRadius: 7,
                background: "rgba(244,63,94,0.08)",
                border: "1px solid rgba(244,63,94,0.2)",
                color: "#f43f5e",
                fontSize: "0.78rem",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <AlertTriangle size={12} /> {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {completing ? (
              <motion.div
                key="completing"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Completion notes (optional)…"
                  autoFocus
                  style={{
                    width: "100%",
                    minHeight: 80,
                    padding: "8px 12px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    color: "#e2e8f0",
                    fontSize: "0.82rem",
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <ActionBtn
                    onClick={() =>
                      patch({
                        status: "done",
                        ...(notes.trim() ? { completion_notes: notes.trim() } : {}),
                      })
                    }
                    disabled={acting}
                    color="#22c55e"
                    variant="outline"
                  >
                    <CheckCircle2 size={13} /> Confirm Done
                  </ActionBtn>
                  <ActionBtn
                    onClick={() => {
                      setCompleting(false);
                      setNotes("");
                    }}
                    disabled={acting}
                    color="#64748b"
                    variant="ghost"
                  >
                    Cancel
                  </ActionBtn>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="actions"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
              >
                {task.status === "pending" && (
                  <ActionBtn
                    onClick={() => patch({ status: "in_progress" })}
                    disabled={acting}
                    color="#38bdf8"
                    variant="outline"
                  >
                    <PlayCircle size={13} /> Start
                  </ActionBtn>
                )}
                <ActionBtn
                  onClick={() => setCompleting(true)}
                  disabled={acting}
                  color="#22c55e"
                  variant="outline"
                >
                  <CheckCircle2 size={13} /> Mark Done
                </ActionBtn>
                <ActionBtn
                  onClick={() => patch({ status: "blocked" })}
                  disabled={acting}
                  color="#f43f5e"
                  variant="outline"
                >
                  <ZapOff size={13} /> Blocked
                </ActionBtn>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Metadata footer */}
      <MetadataFooter
        createdAt={task.created_at}
        updatedAt={task.updated_at}
        nameLabel="Assignee"
        name={task.assigned_username ?? task.assigned_to}
        extra={
          task.due_date
            ? `Due ${new Date(task.due_date).toLocaleDateString()}`
            : undefined
        }
      />
    </div>
  );
}

// ── AGENT TASK CONTENT ────────────────────────────────────────────────────────

interface AgentTaskContentProps {
  agentTask: AgentTask;
  onClose: () => void;
  onAction?: () => void;
}

function AgentTaskContent({
  agentTask,
  onClose,
  onAction,
}: AgentTaskContentProps) {
  const [acting, setActing] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const doAction = useCallback(
    async (endpoint: string, body?: Record<string, unknown>) => {
      setActing(true);
      setError(null);
      try {
        const res = await fetch(`${BOT_URL}/admin/tasks/${agentTask.id}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          const bd = await res.json().catch(() => ({}));
          throw new Error(bd.error ?? `HTTP ${res.status}`);
        }
        onAction?.();
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Action failed");
      } finally {
        setActing(false);
      }
    },
    [agentTask.id, onAction, onClose]
  );

  const isPending = agentTask.status === "pending";

  return (
    <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
      {/* Context / description */}
      {agentTask.body && (
        <div style={{ marginBottom: "1.5rem" }}>
          <SectionLabel>Context / Description</SectionLabel>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: "0.8rem",
              color: "#94a3b8",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {agentTask.body}
          </div>
        </div>
      )}

      {/* Tool to execute */}
      <div style={{ marginBottom: "1.5rem" }}>
        <SectionLabel>Requested Action</SectionLabel>
        <div
          style={{
            background: "rgba(167,139,250,0.06)",
            border: "1px solid rgba(167,139,250,0.15)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: "0.82rem",
            color: "#c4b5fd",
            lineHeight: 1.65,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 11, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
            🔧 {agentTask.tool_name}
          </div>
          {Object.keys(agentTask.tool_input ?? {}).length > 0 && (
            <pre style={{ fontSize: "0.72rem", color: "#a78bfa", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "'JetBrains Mono', monospace" }}>
              {JSON.stringify(agentTask.tool_input, null, 2)}
            </pre>
          )}
        </div>
      </div>

      {/* Human note (rejection reason, if any) */}
      {agentTask.human_note && (
        <div style={{ marginBottom: "1.5rem" }}>
          <SectionLabel>Human Note</SectionLabel>
          <p style={{ fontSize: "0.83rem", color: "#94a3b8", lineHeight: 1.65, margin: 0 }}>
            {agentTask.human_note}
          </p>
        </div>
      )}

      {/* Result (once executed) */}
      {agentTask.result && (
        <div style={{ marginBottom: "1.5rem" }}>
          <SectionLabel>Execution Result</SectionLabel>
          <div style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 8, padding: "10px 14px", fontSize: "0.8rem", color: "#86efac", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
            {agentTask.result}
          </div>
        </div>
      )}

      {/* Approval actions */}
      {isPending && (
        <div style={{ marginBottom: "1.5rem" }}>
          <SectionLabel>Approval</SectionLabel>
          {error && (
            <div
              style={{
                marginBottom: 10,
                padding: "7px 12px",
                borderRadius: 7,
                background: "rgba(244,63,94,0.08)",
                border: "1px solid rgba(244,63,94,0.2)",
                color: "#f43f5e",
                fontSize: "0.78rem",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <AlertTriangle size={12} /> {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {rejectMode ? (
              <motion.div
                key="reject"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Rejection reason / note (optional)…"
                  autoFocus
                  style={{
                    width: "100%",
                    minHeight: 80,
                    padding: "8px 12px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(244,63,94,0.2)",
                    borderRadius: 8,
                    color: "#e2e8f0",
                    fontSize: "0.82rem",
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <ActionBtn
                    onClick={() =>
                      doAction("reject", rejectNote.trim() ? { note: rejectNote.trim() } : undefined)
                    }
                    disabled={acting}
                    color="#f43f5e"
                    variant="outline"
                  >
                    <XCircle size={13} /> Confirm Reject
                  </ActionBtn>
                  <ActionBtn
                    onClick={() => {
                      setRejectMode(false);
                      setRejectNote("");
                    }}
                    disabled={acting}
                    color="#64748b"
                    variant="ghost"
                  >
                    Cancel
                  </ActionBtn>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="approve-reject"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
              >
                <ActionBtn
                  onClick={() => doAction("approve")}
                  disabled={acting}
                  color="#22c55e"
                  variant="solid"
                >
                  <CheckCircle2 size={13} /> Approve
                </ActionBtn>
                <ActionBtn
                  onClick={() => setRejectMode(true)}
                  disabled={acting}
                  color="#f43f5e"
                  variant="outline"
                >
                  <XCircle size={13} /> Reject
                </ActionBtn>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Non-pending status note */}
      {!isPending && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "10px 14px",
            borderRadius: 8,
            background:
              agentTask.status === "approved"
                ? "rgba(167,139,250,0.07)"
                : "rgba(244,63,94,0.06)",
            border: `1px solid ${
              agentTask.status === "approved"
                ? "rgba(167,139,250,0.2)"
                : "rgba(244,63,94,0.15)"
            }`,
          }}
        >
          <p
            style={{
              fontSize: "0.82rem",
              color:
                agentTask.status === "approved" ? "#c4b5fd" : "#fca5a5",
              margin: 0,
            }}
          >
            This task has been{" "}
            <strong>{agentTask.status}</strong>.
          </p>
        </div>
      )}

      <MetadataFooter
        createdAt={agentTask.created_at}
        updatedAt={agentTask.updated_at}
        nameLabel="Agent"
        name={agentTask.agent_name}
      />
    </div>
  );
}

// ── METADATA FOOTER ───────────────────────────────────────────────────────────

interface MetadataFooterProps {
  createdAt: string;
  updatedAt: string;
  nameLabel: string;
  name: string | null | undefined;
  extra?: string;
}

function MetadataFooter({
  createdAt,
  updatedAt,
  nameLabel,
  name,
  extra,
}: MetadataFooterProps) {
  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: "0.75rem",
    color: "#475569",
  };

  return (
    <div
      style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        paddingTop: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      <div style={row}>
        <Clock size={11} />
        <span>Created {timeAgo(createdAt)}</span>
      </div>
      <div style={row}>
        <Clock size={11} />
        <span>Updated {timeAgo(updatedAt)}</span>
      </div>
      {name && (
        <div style={row}>
          {nameLabel === "Agent" ? <Cpu size={11} /> : <User size={11} />}
          <span>
            {nameLabel}: <span style={{ color: "#94a3b8" }}>{name}</span>
          </span>
        </div>
      )}
      {extra && (
        <div style={row}>
          <Flag size={11} />
          <span>{extra}</span>
        </div>
      )}
    </div>
  );
}

// ── MAIN DRAWER ───────────────────────────────────────────────────────────────

export default function WorkDetailDrawer({
  itemId,
  itemType,
  onClose,
  onAction,
}: WorkDetailDrawerProps) {
  const [data, setData] = useState<AgentWork | HumanTask | AgentTask | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const endpointFor = useCallback(
    (id: string) => {
      switch (itemType) {
        case "work":
          return `${BOT_URL}/admin/work/${id}`;
        case "task":
          return `${BOT_URL}/admin/work/human/${id}`;
        case "agent_task":
          return `${BOT_URL}/admin/tasks/${id}`;
      }
    },
    [itemType]
  );

  const fetchItem = useCallback(
    async (id: string, showLoader = false) => {
      if (showLoader) setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(endpointFor(id));
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json = await res.json();
        // APIs may wrap in a named key
        const item =
          json.work ?? json.task ?? json.agent_task ?? json.item ?? json;
        setData(item);
      } catch (err: unknown) {
        setFetchError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [endpointFor]
  );

  // On open: fetch immediately, then optionally poll
  useEffect(() => {
    if (!itemId) {
      setData(null);
      setFetchError(null);
      if (pollRef.current) clearTimeout(pollRef.current);
      return;
    }

    fetchItem(itemId, true);

    const shouldPoll = (d: AgentWork | HumanTask | AgentTask | null) => {
      if (!d) return false;
      // agent_work has status running/in_progress; human_tasks have in_progress; agent_tasks don't poll
      const s = (d as AgentWork | HumanTask).status ?? "";
      return s === "running" || s === "in_progress";
    };

    const schedulePoll = () => {
      pollRef.current = setTimeout(async () => {
        // Fetch latest data to check if still running
        await fetchItem(itemId, false);
        // Re-read state via callback to decide if we should keep polling
        setData((current) => {
          if (shouldPoll(current)) schedulePoll();
          return current;
        });
      }, POLL_INTERVAL_MS);
    };

    // After initial load, determine polling
    setData((current) => {
      if (shouldPoll(current)) schedulePoll();
      return current;
    });

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // Kick off polling evaluation after each data update
  useEffect(() => {
    if (!data || !itemId) return;
    const s = (data as AgentWork).status;
    const isLive = s === "running" || s === "in_progress";
    if (isLive && !pollRef.current) {
      pollRef.current = setTimeout(() => {
        pollRef.current = null;
        fetchItem(itemId, false);
      }, POLL_INTERVAL_MS);
    }
    return () => {
      if (pollRef.current) {
        clearTimeout(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Escape key handler
  useEffect(() => {
    if (!itemId) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [itemId, onClose]);

  // Derive display status
  const displayStatus =
    (data as AgentWork | null)?.status ??
    (data as HumanTask | null)?.status ??
    (data as AgentTask | null)?.status ??
    "pending";

  const displayTitle = (data as AgentWork | null)?.title ?? "Loading…";
  const color = statusColor(displayStatus);

  return (
    <AnimatePresence>
      {itemId && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9998,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.div
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Work item details"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              width: "min(540px, 100vw)",
              display: "flex",
              flexDirection: "column",
              background: "rgba(13,17,27,0.98)",
              borderLeft: "1px solid rgba(255,255,255,0.1)",
              boxShadow: glowShadow(displayStatus),
              overflowY: "hidden",
            }}
          >
            {/* Top close bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1.25rem",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: color,
                    boxShadow: `0 0 6px ${color}`,
                  }}
                />
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {itemType === "work"
                    ? "Agent Work"
                    : itemType === "task"
                    ? "Human Task"
                    : "Pending Approval"}
                </span>
              </div>
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1, color: "#e2e8f0" }}
                whileTap={{ scale: 0.9 }}
                aria-label="Close drawer"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#475569",
                  display: "flex",
                  alignItems: "center",
                  padding: 4,
                  borderRadius: 6,
                }}
              >
                <X size={18} />
              </motion.button>
            </div>

            {/* Content area */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div
                    key="skeleton"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <DrawerSkeleton />
                  </motion.div>
                ) : fetchError ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{
                      padding: "2rem 1.5rem",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 12,
                      textAlign: "center",
                    }}
                  >
                    <AlertTriangle size={32} color="#f43f5e" />
                    <p
                      style={{
                        color: "#f43f5e",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        margin: 0,
                      }}
                    >
                      {fetchError}
                    </p>
                    <button
                      onClick={() => itemId && fetchItem(itemId, true)}
                      style={{
                        padding: "7px 16px",
                        borderRadius: 8,
                        background: "rgba(244,63,94,0.1)",
                        border: "1px solid rgba(244,63,94,0.25)",
                        color: "#f43f5e",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Retry
                    </button>
                  </motion.div>
                ) : data ? (
                  <motion.div
                    key="content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ display: "flex", flexDirection: "column", flex: 1 }}
                  >
                    {/* Header band */}
                    <HeaderBand
                      status={displayStatus}
                      title={displayTitle}
                      agentOrAssignee={
                        itemType === "task"
                          ? ((data as HumanTask).assigned_username ??
                            (data as HumanTask).assigned_to)
                          : ((data as AgentWork | AgentTask).agent_name ?? null)
                      }
                      priority={(data as AgentWork | AgentTask).priority ?? 5}
                      effortTier={(data as AgentWork | HumanTask).effort_tier ?? null}
                    />

                    {/* Type-specific content */}
                    {itemType === "work" && (
                      <AgentWorkContent
                        work={data as AgentWork}
                        onClose={onClose}
                        onAction={onAction}
                      />
                    )}
                    {itemType === "task" && (
                      <HumanTaskContent
                        task={data as HumanTask}
                        onClose={onClose}
                        onAction={onAction}
                      />
                    )}
                    {itemType === "agent_task" && (
                      <AgentTaskContent
                        agentTask={data as AgentTask}
                        onClose={onClose}
                        onAction={onAction}
                      />
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
