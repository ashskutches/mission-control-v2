"use client";

import { motion } from "framer-motion";
import { CheckCheck } from "lucide-react";
import { SectionLabel } from "./primitives";

/** Vertical milestone/step timeline shown for multi-step agent work. */

// ── MILESTONE TIMELINE ────────────────────────────────────────────────────────

export interface MilestoneTimelineProps {
  milestones: { label: string; done?: boolean }[];
  currentMilestone: number;
}

export function MilestoneTimeline({
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

