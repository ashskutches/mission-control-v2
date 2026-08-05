"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Mail, Bot, CheckCircle2, Timer, TrendingUp, TrendingDown, ChevronDown,
  ChevronRight, Minus, HelpCircle, Inbox, AlertTriangle, Smile, ArrowRight, Brain,
} from "lucide-react";
import {
  Panel, Metric, Sparkline, Pill, Btn, SUPPORT_ACCENT, ago,
  Loading, ErrorBox, NotConnected, Empty,
} from "./ui";
import { getMetrics, getSummary, runReflection } from "./api";

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

export default function SupportDashboard() {
  const [days, setDays] = useState(7);
  const [showBasis, setShowBasis] = useState(false);
  const [m, setM] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [metrics, sum] = await Promise.all([getMetrics(days), getSummary()]);
      setM(metrics); setSummary(sum);
    } catch (e: any) { setErr(e.message); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const reflect = async () => {
    setBusy(true); setNote(null);
    try {
      const r = await runReflection();
      setNote(r.skipped ? `Nothing to reflect on — ${r.skipped}.` : `Reflection done: ${r.created} new items.`);
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (err && !m) return <ErrorBox error={err} onRetry={load} />;
  if (!m) return <Loading label="Loading metrics" />;

  const pct = (v: number | null) => v == null ? "Not measured" : `${Math.round(v * 100)}%`;
  const rangeLabel = RANGES.find(r => r.days === days)?.label ?? `${days} days`;

  return (
    <>
      {summary?.mail?.blockers?.length > 0 && <NotConnected blockers={summary.mail.blockers} />}
      {err && <ErrorBox error={err} onRetry={load} />}
      {note && (
        <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)",
                      borderRadius: 10, padding: "0.6rem 0.9rem", marginBottom: "1rem",
                      fontSize: 12, color: "#22c55e", fontWeight: 600 }}>{note}</div>
      )}

      {/* A sampled rate looks identical to a real one, so say it out loud. */}
      {m.sampled && (
        <div style={{
          background: "rgba(245,168,64,0.07)", border: "1px solid rgba(245,168,64,0.28)",
          borderRadius: 10, padding: "0.6rem 0.9rem", marginBottom: "1rem",
          fontSize: 11.5, color: "#f5a840", lineHeight: 1.55,
        }}>
          <strong>Rates below are sampled.</strong> {m.ticketsIn.toLocaleString()} tickets landed in
          this window; the percentages and the volume chart are computed from the most recent{" "}
          {m.sampleSize?.toLocaleString()}. The ticket count itself is exact.
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.35rem" }}>
          {RANGES.map(r => (
            <Pill key={r.days} color={SUPPORT_ACCENT} active={days === r.days} onClick={() => setDays(r.days)}>
              {r.label}
            </Pill>
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
                sub={`over ${rangeLabel.toLowerCase()}`} icon={Mail} color="#4a9eff" />
        <Metric label="Automation rate" value={pct(m.automationRate)}
                unmeasured={m.automationRate == null} trend={m.automationRateTrend}
                sub={m.automationRate == null ? "no drafts reviewed yet" : "approved without edits"}
                icon={Bot} color={SUPPORT_ACCENT} />
        <Metric label="First contact resolution" value={pct(m.fcrRate)}
                unmeasured={m.fcrRate == null} trend={m.fcrRateTrend}
                sub={m.fcrRate == null ? "no resolved tickets yet" : "no customer follow-up"}
                icon={CheckCircle2} color="#22c55e" />
        <Metric label="Median first response"
                value={m.medianFirstResponseMinutes == null ? "Not measured" : `${m.medianFirstResponseMinutes}m`}
                unmeasured={m.medianFirstResponseMinutes == null}
                trend={m.medianFirstResponseTrend} invertTrend sub="inbound → sent"
                icon={Timer} color="#a78bfa" />
        <Metric label="CSAT" value="Not measured" unmeasured icon={Smile} color="#6b7280"
                sub="no survey wired up" />
      </div>

      {/* Row 2 — volume + money */}
      <div style={{ display: "grid", gap: "0.9rem", marginBottom: "0.9rem",
                    gridTemplateColumns: "minmax(260px, 1fr) minmax(340px, 1.4fr)" }}>
        <Panel title="Volume" subtitle={`Tickets per day · ${rangeLabel.toLowerCase()}`}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{m.ticketsIn}</span>
            {m.ticketsInTrend != null && (
              <span style={{ fontSize: 11, fontWeight: 700,
                             color: m.ticketsInTrend > 0 ? "#22c55e" : "#f43f5e",
                             display: "inline-flex", alignItems: "center", gap: 3 }}>
                {m.ticketsInTrend > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {m.ticketsInTrend > 0 ? "+" : ""}{m.ticketsInTrend}%
              </span>
            )}
          </div>
          {m.volumeSeries?.some((v: number) => v > 0)
            ? <Sparkline data={m.volumeSeries} />
            : <div style={{ fontSize: 11.5, color: "var(--text-muted)", padding: "0.6rem 0" }}>
                No tickets in this window yet.
              </div>}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6,
                        fontSize: 10, color: "var(--text-dim)" }}>
            <span>{days}d ago</span><span>today</span>
          </div>
        </Panel>

        {/* Money stays one line per figure; the calculation is one click away. A
            dollar number you can't audit is decoration — but it doesn't need to
            shout its arithmetic at you every morning. */}
        <Panel
          title="Money"
          subtitle="Every figure shows what it was calculated from — or why it can't be"
          right={
            <Pill color={SUPPORT_ACCENT} active={showBasis} onClick={() => setShowBasis(!showBasis)}>
              {showBasis ? "Hide maths" : "Show maths"}
            </Pill>
          }
        >
          <div style={{ display: "grid", gap: "0.4rem" }}>
            {m.moneyLines?.map((b: any) => (
              <MoneyRow key={b.label} label={b.label} value={b.value} basis={b.basis}
                        color="#22c55e" open={showBasis} />
            ))}
            <MoneyRow label={m.revenue?.label ?? "Revenue attributed"}
                      value={m.revenue?.value} basis={m.revenue?.basis ?? ""}
                      color="#4a9eff" open={showBasis} tint />
          </div>
        </Panel>
      </div>

      {/* Row 3 — top issues + top insights */}
      <div style={{ display: "grid", gap: "0.9rem",
                    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <Panel title="Top issues" subtitle="From the fixed category taxonomy" pad={false}>
          {!m.topIssues?.length ? (
            <Empty icon={Inbox} title="No tickets yet"
                   body="Categories appear here once mail starts arriving." />
          ) : m.topIssues.map((c: any, i: number) => (
            <div key={c.slug} style={{
              display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 1.1rem",
              borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
            }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: "var(--text-dim)", width: 14 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{c.label}</div>
                <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", marginTop: 5 }}>
                  <div style={{ width: `${(c.count / (m.topIssues[0]?.count || 1)) * 100}%`, height: "100%",
                                background: SUPPORT_ACCENT, borderRadius: 2, opacity: 0.75 }} />
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, width: 30, textAlign: "right" }}>{c.count}</span>
              <span style={{ fontSize: 10.5, color: "var(--text-muted)", width: 46, textAlign: "right" }}>
                {c.pctOfTotal}%
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, width: 46,
                             justifyContent: "flex-end", fontSize: 10.5, fontWeight: 700,
                             color: "var(--text-dim)" }}
                    title={c.trendPct == null ? "No comparable prior period yet" : ""}>
                <Minus size={10} />{c.trendPct == null ? "—" : `${Math.abs(c.trendPct)}%`}
              </span>
            </div>
          ))}
        </Panel>

        <Panel
          title="Top insights"
          subtitle="Ranked by evidence × confidence — never by how well they're written"
          right={<Link href="/support/learning" style={{ textDecoration: "none" }}>
            <Pill color={SUPPORT_ACCENT}>View all</Pill>
          </Link>}
          pad={false}
        >
          {!m.topInsights?.length ? (
            <Empty icon={Brain} title="Nothing learned yet"
                   body="Insights appear after the agent reflects on real corrections. Correct a draft, then run a reflection." />
          ) : m.topInsights.map((o: any, i: number) => (
            <Link key={o.id} href="/support/learning" style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{
                padding: "0.7rem 1.1rem",
                borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
                display: "flex", gap: "0.7rem", alignItems: "flex-start",
              }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: "var(--text-dim)", width: 14, paddingTop: 2 }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.45, marginBottom: 5 }}>
                    {o.title}
                  </div>
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                    {o.kind === "question"
                      ? <Pill color="#a78bfa" solid><HelpCircle size={9} /> Question</Pill>
                      : <Pill color={SUPPORT_ACCENT}>Observation</Pill>}
                    <Pill color="#f5a840">{o.evidence_count} corrections</Pill>
                    <Pill>{Math.round(Number(o.confidence) * 100)}% conf</Pill>
                    {o.status === "accepted" && <Pill color="#22c55e" solid>Accepted</Pill>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </Panel>
      </div>

      {/* Row 4 — reflection status */}
      <div style={{ marginTop: "0.9rem" }}>
        <Panel title="Learning loop">
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
                            textTransform: "uppercase", color: "var(--text-muted)" }}>Last reflection</div>
              {m.lastReflection ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3 }}>
                    {new Date(m.lastReflection.started_at).toLocaleString("en-US", {
                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    {" · "}{m.lastReflection.corrections_considered} corrections read
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                    {m.lastReflection.observations_created} observations ·{" "}
                    {m.lastReflection.questions_created} questions ·{" "}
                    {m.lastReflection.doc_proposals_created} doc proposals
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>
                  Never run. It needs corrections to reflect on.
                </div>
              )}
            </div>
            <div style={{ flex: 1 }} />
            {m.unreflectedCount > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(245,168,64,0.08)", border: "1px solid rgba(245,168,64,0.25)",
                borderRadius: 9, padding: "0.45rem 0.8rem",
              }}>
                <AlertTriangle size={13} color="#f5a840" />
                <span style={{ fontSize: 12, color: "#f5a840", fontWeight: 600 }}>
                  {m.unreflectedCount} new correction{m.unreflectedCount === 1 ? "" : "s"} not yet reflected on
                </span>
              </div>
            )}
            <Btn variant="outline" color={SUPPORT_ACCENT} onClick={reflect}
                 disabled={busy || !m.unreflectedCount}
                 title={!m.unreflectedCount ? "Nothing new to reflect on" : ""}>
              <Brain size={13} /> {busy ? "Reflecting…" : "Reflect now"}
            </Btn>
          </div>
        </Panel>
      </div>
    </>
  );
}

/** One money figure. Collapsed by default; a null value means not calculable,
 *  and the basis then explains what's missing rather than showing $0. */
function MoneyRow({ label, value, basis, color, open, tint }: {
  label: string; value: string | null; basis: string; color: string; open: boolean; tint?: boolean;
}) {
  const [self, setSelf] = useState(false);
  const shown = open || self;
  const unavailable = value == null;
  return (
    <div
      onClick={() => setSelf(!self)}
      style={{
        background: tint ? "rgba(74,158,255,0.05)" : "rgba(255,255,255,0.025)",
        border: `1px solid ${tint ? "rgba(74,158,255,0.2)" : "rgba(255,255,255,0.05)"}`,
        borderRadius: 9, padding: "0.5rem 0.75rem", cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
          {shown ? <ChevronDown size={11} color="var(--text-dim)" />
                 : <ChevronRight size={11} color="var(--text-dim)" />}
          {label}
        </span>
        <span style={{
          fontSize: unavailable ? 11.5 : 15, fontWeight: 800,
          color: unavailable ? "var(--text-dim)" : color,
        }}>
          {value ?? "Not calculable"}
        </span>
      </div>
      {shown && (
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 5,
                      lineHeight: 1.55, paddingLeft: 16 }}>
          {basis}
        </div>
      )}
    </div>
  );
}
