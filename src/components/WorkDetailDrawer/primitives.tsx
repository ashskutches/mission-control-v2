"use client";

import React from "react";
import { motion } from "framer-motion";

/** Small presentational building blocks shared by the three content panes. */

// ── Skeleton loader ────────────────────────────────────────────────────────────

export function SkeletonLine({
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

export function DrawerSkeleton() {
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

export function SectionLabel({ children }: { children: React.ReactNode }) {
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

export function Badge({
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

export interface ActionBtnProps {
  onClick: () => void;
  disabled?: boolean;
  color: string;
  children: React.ReactNode;
  variant?: "solid" | "outline" | "ghost";
}

export function ActionBtn({
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

