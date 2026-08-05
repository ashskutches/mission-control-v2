"use client";
import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search, Inbox as InboxIcon, AlertTriangle, Flame, ChevronRight, Bot, UserCheck,
} from "lucide-react";
import {
  SampleBanner, Panel, Pill, Confidence, Empty, ago,
  STATUS_COLOR, STATUS_LABEL, SUPPORT_ACCENT,
} from "../ui";
import { TICKETS, categoryLabel } from "../fixtures";
import type { TicketStatus } from "../types";

const FILTERS: { key: TicketStatus | "all"; label: string }[] = [
  { key: "awaiting_approval", label: "Awaiting approval" },
  { key: "escalated",         label: "Escalated" },
  { key: "sent",              label: "Sent" },
  { key: "resolved",          label: "Resolved" },
  { key: "all",               label: "All" },
];

const SENTIMENT_COLOR: Record<string, string> = {
  angry: "#f43f5e", frustrated: "#f5a840", neutral: "#6b7280", positive: "#22c55e",
};

export default function SupportInbox() {
  const [filter, setFilter] = useState<TicketStatus | "all">("awaiting_approval");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return TICKETS
      .filter(t => filter === "all" || t.status === filter)
      .filter(t => !q.trim() ||
        `${t.ref} ${t.subject} ${t.customerName} ${t.customerEmail}`.toLowerCase().includes(q.toLowerCase()))
      // Oldest-waiting first. A queue sorted newest-first quietly starves the
      // ticket that's been sitting for two hours.
      .sort((a, b) => b.awaitingMinutes - a.awaitingMinutes);
  }, [filter, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: TICKETS.length };
    TICKETS.forEach(t => { c[t.status] = (c[t.status] ?? 0) + 1; });
    return c;
  }, []);

  return (
    <>
      <SampleBanner />

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap",
                    alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {FILTERS.map(f => (
            <Pill key={f.key} color={f.key === "all" ? SUPPORT_ACCENT : (STATUS_COLOR[f.key] ?? SUPPORT_ACCENT)}
                  active={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}{counts[f.key] ? ` ${counts[f.key]}` : ""}
            </Pill>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: "relative", minWidth: 220 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%",
                                     transform: "translateY(-50%)", color: "var(--text-dim)" }} />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search subject, customer, ref…"
            style={{
              width: "100%", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9,
              padding: "0.42rem 0.7rem 0.42rem 1.9rem", fontSize: 12,
              color: "var(--text-primary)", fontFamily: "inherit", outline: "none",
            }}
          />
        </div>
      </div>

      <Panel pad={false}>
        {/* Column header — the price of one-line rows is that they need labels. */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "0.4rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.06)",
          fontSize: 9, fontWeight: 800, letterSpacing: "0.09em",
          textTransform: "uppercase", color: "var(--text-dim)",
        }}>
          <span style={{ width: 3, flexShrink: 0 }} />
          <span style={{ width: 40, flexShrink: 0 }}>Ref</span>
          <span style={{ flex: 1, minWidth: 0 }}>Subject</span>
          <span style={{ width: 116, flexShrink: 0 }}>Customer</span>
          <span style={{ width: 112, flexShrink: 0 }}>Category</span>
          <span style={{ width: 82, flexShrink: 0, textAlign: "right" }}>Conf.</span>
          <span style={{ width: 124, flexShrink: 0, textAlign: "right" }}>Status</span>
          <span style={{ width: 58, flexShrink: 0, textAlign: "right" }}>Waiting</span>
          <span style={{ width: 14, flexShrink: 0 }} />
        </div>

        {rows.length === 0 ? (
          <Empty icon={InboxIcon} title="Nothing here"
                 body="No tickets match this filter." />
        ) : rows.map((t, i) => {
          const overdue = t.status === "awaiting_approval" && t.awaitingMinutes > 60;
          return (
            <Link key={t.id} href={`/support/inbox/${t.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div
                style={{
                  display: "flex", alignItems: "center", gap: "0.9rem",
                  padding: "0.45rem 1.1rem", height: 38,
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
                  transition: "background .15s", cursor: "pointer",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {/* One line per ticket. At 20–60/day the whole queue fits on one
                    screen, which it doesn't if every row is a two-line card.
                    Everything else lives on the drill-down. */}
                <div style={{
                  width: 3, height: 16, borderRadius: 2, flexShrink: 0,
                  background: SENTIMENT_COLOR[t.sentiment] ?? "transparent",
                  opacity: t.sentiment === "neutral" ? 0.18 : 0.9,
                }} />

                <span style={{ width: 40, flexShrink: 0, fontSize: 10.5, fontWeight: 800,
                               color: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace" }}>
                  {t.ref}
                </span>

                <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1, minWidth: 0,
                               overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.subject}
                  {t.priority === "high" && (
                    <Flame size={10} color="#f43f5e" style={{ marginLeft: 6, verticalAlign: -1 }} />
                  )}
                </span>

                <span style={{ width: 116, flexShrink: 0, fontSize: 11, color: "var(--text-muted)",
                               overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.customerName}
                </span>

                <span style={{ width: 112, flexShrink: 0, fontSize: 11, color: "var(--text-dim)",
                               overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {categoryLabel(t.category)}
                </span>

                <span style={{ width: 82, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
                  {t.draft
                    ? <Confidence value={t.draft.confidence} />
                    : <Pill color="#a78bfa"><UserCheck size={9} /> none</Pill>}
                </span>

                <span style={{ width: 124, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
                  <Pill color={STATUS_COLOR[t.status]} solid>{STATUS_LABEL[t.status]}</Pill>
                </span>

                <span style={{ width: 58, flexShrink: 0, textAlign: "right", fontSize: 11,
                               fontWeight: 700, color: overdue ? "#f43f5e" : "var(--text-muted)",
                               display: "inline-flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                  {overdue && <AlertTriangle size={10} />}
                  {t.status === "awaiting_approval" ? ago(t.awaitingMinutes) : "—"}
                </span>

                <ChevronRight size={14} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
              </div>
            </Link>
          );
        })}
      </Panel>

      <div style={{ marginTop: "0.8rem", display: "flex", alignItems: "center", gap: 8,
                    fontSize: 11, color: "var(--text-muted)" }}>
        <Bot size={12} />
        Sorted oldest-waiting first. Bulk approve is deliberately capped — see the plan doc.
      </div>
    </>
  );
}
