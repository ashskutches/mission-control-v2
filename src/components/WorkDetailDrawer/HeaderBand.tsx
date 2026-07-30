"use client";

import { CircleDot } from "lucide-react";
import { EFFORT_COLOR, EFFORT_LABEL, STATUS_ICON, STATUS_LABEL, statusColor } from "./constants";
import { Badge } from "./primitives";
import type { EffortTier } from "./types";

/** Coloured drawer header: title, status badge and close control. */

// ── HEADER BAND ───────────────────────────────────────────────────────────────

export interface HeaderBandProps {
  status: string;
  title: string;
  agentOrAssignee: string | null;
  priority: number;
  effortTier: EffortTier | null;
}

export function HeaderBand({
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

