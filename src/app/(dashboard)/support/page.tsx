"use client";
import React, { useState } from "react";
import Link from "next/link";
import {
  Mail, Bot, CheckCircle2, Timer, PiggyBank, TrendingUp, TrendingDown,
  Minus, HelpCircle, Inbox, AlertTriangle, Smile, ArrowRight, Brain,
} from "lucide-react";
import {
  SampleBanner, Panel, Metric, Sparkline, Pill, Btn, SUPPORT_ACCENT, ago,
} from "./ui";
import { METRICS, OBSERVATIONS, LAST_REFLECTION, UNREFLECTED_COUNT } from "./fixtures";

const RANGES = ["7 days", "30 days", "This month"];

export default function SupportDashboard() {
  const [range, setRange] = useState("7 days");
  const m = METRICS;

  // Ranked observations. evidenceCount × confidence, accepted boosted, dismissed out.
  // The evidence count is shown on the card — it's what separates a credible insight
  // from a well-written thin one.
  const topInsights = [...OBSERVATIONS]
    .filter(o => o.status !== "dismissed" && o.kind !== "category_proposal")
    .sort((a, b) =>
      (b.evidenceCount * b.confidence + (b.status === "accepted" ? 1 : 0)) -
      (a.evidenceCount * a.confidence + (a.status === "accepted" ? 1 : 0)))
    .slice(0, 5);

  const pct = (v: number | null) => v == null ? "—" : `${Math.round(v * 100)}%`;

  return (
    <>
      <SampleBanner />

      {/* Range selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.35rem" }}>
          {RANGES.map(r => (
            <Pill key={r} color={SUPPORT_ACCENT} active={range === r} onClick={() => setRange(r)}>{r}</Pill>
          ))}
        </div>
        {m.reviewQueueDepth > 0 && (
          <Link href="/support/inbox" style={{ textDecoration: "none" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(245,168,64,0.1)", border: "1px solid rgba(245,168,64,0.3)",
              borderRadius: 9, padding: "0.4rem 0.8rem", fontSize: 12, fontWeight: 700, color: "#f5a840",
            }}>
              <Inbox size={13} />
              {m.reviewQueueDepth} awaiting approval · oldest {ago(m.oldestWaitingMinutes)}
              <ArrowRight size={13} />
            </span>
          </Link>
        )}
      </div>

      {/* Row 1 — headline metrics */}
      <div style={{ display: "grid", gap: "0.9rem", marginBottom: "0.9rem",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Metric label="Emails in" value={String(m.ticketsIn)} trend={m.ticketsInTrend}
                sub={`over ${range.toLowerCase()}`} icon={Mail} color="#4a9eff" />
        <Metric label="Automation rate" value={pct(m.automationRate)} trend={m.automationRateTrend}
                sub="approved without edits" icon={Bot} color={SUPPORT_ACCENT} />
        <Metric label="First contact resolution" value={pct(m.fcrRate)} trend={m.fcrRateTrend}
                sub="no customer follow-up" icon={CheckCircle2} color="#22c55e" />
        <Metric label="Median first response"
                value={m.medianFirstResponseMinutes == null ? "—" : `${m.medianFirstResponseMinutes}m`}
                trend={m.medianFirstResponseTrend} invertTrend sub="inbound → sent"
                icon={Timer} color="#a78bfa" />
        <Metric label="CSAT" value="Not measured" unmeasured icon={Smile} color="#6b7280"
                sub="no survey wired up" />
      </div>

      {/* Row 2 — volume + money */}
      <div style={{ display: "grid", gap: "0.9rem", marginBottom: "0.9rem",
                    gridTemplateColumns: "minmax(260px, 1fr) minmax(340px, 1.4fr)" }}>
        <Panel title="Volume" subtitle={`Tickets per day · ${range.toLowerCase()}`}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{m.ticketsIn}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e",
                           display: "inline-flex", alignItems: "center", gap: 3 }}>
              <TrendingUp size={11} />+{m.ticketsInTrend}%
            </span>
          </div>
          <Sparkline data={m.volumeSeries} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6,
                        fontSize: 10, color: "var(--text-dim)" }}>
            <span>7d ago</span><span>today</span>
          </div>
        </Panel>

        {/* Money saved — every figure carries its basis. A dollar number with no
            stated calculation is decoration, so the calculation is on the card. */}
        <Panel
          title="Money"
          subtitle="Every figure shows the calculation behind it"
          right={<Pill color="#22c55e" solid>{m.moneySavedTotal} saved</Pill>}
        >
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {m.moneySavedBreakdown.map(b => (
              <div key={b.label} style={{
                background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 9, padding: "0.6rem 0.75rem",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{b.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#22c55e" }}>{b.value}</span>
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
                  {b.basis}
                </div>
              </div>
            ))}

            <div style={{
              background: "rgba(74,158,255,0.05)", border: "1px solid rgba(74,158,255,0.2)",
              borderRadius: 9, padding: "0.6rem 0.75rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Revenue attributed</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#4a9eff" }}>
                  {m.revenueAttributed ?? "Not attributable"}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
                {m.revenueBasis}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Row 3 — top issues + top insights */}
      <div style={{ display: "grid", gap: "0.9rem",
                    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <Panel title="Top 5 issues" subtitle="From the fixed category taxonomy" pad={false}>
          <div>
            {m.topIssues.map((c, i) => {
              const T = c.trendPct == null ? Minus : c.trendPct === 0 ? Minus : c.trendPct > 0 ? TrendingUp : TrendingDown;
              const tc = c.trendPct == null || c.trendPct === 0 ? "var(--text-muted)" : c.trendPct > 0 ? "#f5a840" : "#22c55e";
              return (
                <div key={c.slug} style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.7rem 1.1rem",
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: "var(--text-dim)", width: 14 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{c.label}</div>
                    <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", marginTop: 5 }}>
                      <div style={{ width: `${(c.count / m.topIssues[0].count) * 100}%`, height: "100%",
                                    background: SUPPORT_ACCENT, borderRadius: 2, opacity: 0.75 }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, width: 30, textAlign: "right" }}>{c.count}</span>
                  <span style={{ fontSize: 10.5, color: "var(--text-muted)", width: 42, textAlign: "right" }}>
                    {c.pctOfTotal}%
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 2, width: 46,
                                 justifyContent: "flex-end", fontSize: 10.5, fontWeight: 700, color: tc }}>
                    <T size={10} />{c.trendPct == null ? "—" : `${Math.abs(c.trendPct)}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Top 5 insights"
          subtitle="Ranked by evidence × confidence — never by how well they're written"
          right={<Link href="/support/learning" style={{ textDecoration: "none" }}>
            <Pill color={SUPPORT_ACCENT}>View all</Pill>
          </Link>}
          pad={false}
        >
          <div>
            {topInsights.map((o, i) => (
              <Link key={o.id} href="/support/learning" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{
                  padding: "0.7rem 1.1rem",
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
                  display: "flex", gap: "0.7rem", alignItems: "flex-start",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: "var(--text-dim)", width: 14, paddingTop: 2 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.45, marginBottom: 5 }}>
                      {o.title}
                    </div>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      {o.kind === "question"
                        ? <Pill color="#a78bfa" solid><HelpCircle size={9} /> Question</Pill>
                        : <Pill color={SUPPORT_ACCENT}>Observation</Pill>}
                      <Pill color="#f5a840">{o.evidenceCount} corrections</Pill>
                      <Pill>{Math.round(o.confidence * 100)}% conf</Pill>
                      {o.status === "accepted" && <Pill color="#22c55e" solid>Accepted</Pill>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      {/* Row 4 — reflection status */}
      <div style={{ marginTop: "0.9rem" }}>
        <Panel title="Learning loop">
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
                            textTransform: "uppercase", color: "var(--text-muted)" }}>Last reflection</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3 }}>
                Aug 3, 2:04 AM · {LAST_REFLECTION.correctionsConsidered} corrections read
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                {LAST_REFLECTION.observationsCreated} observations · {LAST_REFLECTION.questionsCreated} questions ·
                {" "}{LAST_REFLECTION.docProposalsCreated} doc proposals
              </div>
            </div>
            <div style={{ flex: 1 }} />
            {UNREFLECTED_COUNT > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(245,168,64,0.08)", border: "1px solid rgba(245,168,64,0.25)",
                borderRadius: 9, padding: "0.45rem 0.8rem",
              }}>
                <AlertTriangle size={13} color="#f5a840" />
                <span style={{ fontSize: 12, color: "#f5a840", fontWeight: 600 }}>
                  {UNREFLECTED_COUNT} new corrections not yet reflected on
                </span>
              </div>
            )}
            <Btn variant="outline" color={SUPPORT_ACCENT}><Brain size={13} /> Reflect now</Btn>
          </div>
        </Panel>
      </div>
    </>
  );
}
