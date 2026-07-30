"use client";

/**
 * WorkDetailDrawer
 * A slide-in right-side drawer showing full details for any agent work item,
 * human task, or agent task pending approval.
 *
 * Used from both /queue and /work pages.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";
import { AgentTaskContent } from "./AgentTaskContent";
import { AgentWorkContent } from "./AgentWorkContent";
import { HeaderBand } from "./HeaderBand";
import { HumanTaskContent } from "./HumanTaskContent";
import { BOT_URL, POLL_INTERVAL_MS, glowShadow, statusColor } from "./constants";
import { DrawerSkeleton } from "./primitives";
import type { AgentTask, AgentWork, HumanTask, WorkDetailDrawerProps } from "./types";

export type { ItemType, WorkDetailDrawerProps } from "./types";

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
