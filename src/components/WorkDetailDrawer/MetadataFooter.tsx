"use client";

import React from "react";
import { Clock, User, Cpu, Flag } from "lucide-react";
import { timeAgo } from "./constants";

/** Timestamps and ids pinned to the bottom of the drawer. */

// ── METADATA FOOTER ───────────────────────────────────────────────────────────

export interface MetadataFooterProps {
  createdAt: string;
  updatedAt: string;
  nameLabel: string;
  name: string | null | undefined;
  extra?: string;
}

export function MetadataFooter({
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

