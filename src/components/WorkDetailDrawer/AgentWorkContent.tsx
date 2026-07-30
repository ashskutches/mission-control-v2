"use client";

import React, { useState, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { MetadataFooter } from "./MetadataFooter";
import { MilestoneTimeline } from "./MilestoneTimeline";
import { BOT_URL, OUTPUT_TRUNCATE_LEN } from "./constants";
import { ActionBtn, SectionLabel } from "./primitives";
import type { AgentWork, WorkStatus } from "./types";

/** Detail pane for an `agent_work` row (research or task). */

// ── AGENT WORK CONTENT ────────────────────────────────────────────────────────

export interface AgentWorkContentProps {
  work: AgentWork;
  onClose: () => void;
  onAction?: () => void;
}

export function AgentWorkContent({ work, onClose, onAction }: AgentWorkContentProps) {
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

