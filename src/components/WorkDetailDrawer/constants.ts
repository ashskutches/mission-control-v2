import React from "react";
import { CheckCircle2, XCircle, AlertTriangle, Loader, CircleDot, ZapOff } from "lucide-react";
import type { EffortTier } from "./types";

/** Polling/target config, status → colour/label/icon lookup maps, and small formatters. */

// ── Constants ──────────────────────────────────────────────────────────────────

export const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";
export const POLL_INTERVAL_MS = 8_000;
export const OUTPUT_TRUNCATE_LEN = 600;

// ── Status colour maps ────────────────────────────────────────────────────────

export const STATUS_COLOR: Record<string, string> = {
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

export const STATUS_LABEL: Record<string, string> = {
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

export const STATUS_ICON: Record<string, React.ElementType> = {
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

export const CARD_BG: Record<string, string> = {
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

export const EFFORT_LABEL: Record<EffortTier, string> = {
  quick: "Quick",
  moderate: "Moderate",
  involved: "Involved",
  epic: "Epic",
};

export const EFFORT_COLOR: Record<EffortTier, string> = {
  quick: "#22c55e",
  moderate: "#f59e0b",
  involved: "#f97316",
  epic: "#f43f5e",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

export function timeAgo(ts: string | null | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function statusColor(s: string): string {
  return STATUS_COLOR[s] ?? "#64748b";
}

export function glowShadow(s: string): string {
  const c = statusColor(s);
  return `0 0 40px ${c}18, inset 0 0 0 1px rgba(255,255,255,0.04)`;
}

