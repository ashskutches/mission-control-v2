"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { MetadataFooter } from "./MetadataFooter";
import { BOT_URL } from "./constants";
import { ActionBtn, SectionLabel } from "./primitives";
import type { AgentTask } from "./types";

/** Detail pane for an `agent_tasks` row awaiting approve/reject. */

// ── AGENT TASK CONTENT ────────────────────────────────────────────────────────

export interface AgentTaskContentProps {
  agentTask: AgentTask;
  onClose: () => void;
  onAction?: () => void;
}

export function AgentTaskContent({
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

