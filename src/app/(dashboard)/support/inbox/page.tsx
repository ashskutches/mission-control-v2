"use client";
import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search, Inbox as InboxIcon, AlertTriangle, Flame, ChevronRight, Bot, UserCheck,
} from "lucide-react";
import {
  SampleBanner, Panel, Pill, Confidence, Empty, ago, fmtDate,
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
                  padding: "0.85rem 1.1rem",
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
                  transition: "background .15s", cursor: "pointer",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {/* priority / sentiment marker */}
                <div style={{
                  width: 3, alignSelf: "stretch", borderRadius: 2, flexShrink: 0,
                  background: SENTIMENT_COLOR[t.sentiment] ?? "transparent",
                  opacity: t.sentiment === "neutral" ? 0.2 : 0.9,
                }} />

                <div style={{ width: 46, flexShrink: 0, fontSize: 11, fontWeight: 800,
                              color: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace" }}>
                  {t.ref}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, overflow: "hidden",
                                   textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.subject}
                    </span>
                    {t.priority === "high" && <Flame size={11} color="#f43f5e" />}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                                fontSize: 11, color: "var(--text-muted)" }}>
                    <span>{t.customerName}</span>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span>{categoryLabel(t.category)}</span>
                    {t.orderRef && <>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.orderRef}</span>
                    </>}
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span>{fmtDate(t.firstInboundAt)}</span>
                  </div>
                </div>

                {/* who's drafting */}
                <div style={{ width: 86, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
                  {t.draft
                    ? <Confidence value={t.draft.confidence} />
                    : <Pill color="#a78bfa"><UserCheck size={9} /> No draft</Pill>}
                </div>

                <div style={{ width: 132, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
                  <Pill color={STATUS_COLOR[t.status]} solid>{STATUS_LABEL[t.status]}</Pill>
                </div>

                <div style={{ width: 76, flexShrink: 0, textAlign: "right", fontSize: 11,
                              fontWeight: 700, color: overdue ? "#f43f5e" : "var(--text-muted)",
                              display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                  {overdue && <AlertTriangle size={11} />}
                  {t.status === "awaiting_approval" ? ago(t.awaitingMinutes) : "—"}
                </div>

                <ChevronRight size={15} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
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
