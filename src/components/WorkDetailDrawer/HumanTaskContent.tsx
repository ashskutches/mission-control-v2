"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, PlayCircle, ZapOff } from "lucide-react";
import { MetadataFooter } from "./MetadataFooter";
import { BOT_URL } from "./constants";
import { ActionBtn, SectionLabel } from "./primitives";
import type { HumanTask } from "./types";

/** Detail pane for a `human_tasks` row. */

// ── HUMAN TASK CONTENT ────────────────────────────────────────────────────────

export interface HumanTaskContentProps {
  task: HumanTask;
  onClose: () => void;
  onAction?: () => void;
}

export function HumanTaskContent({ task, onClose, onAction }: HumanTaskContentProps) {
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

