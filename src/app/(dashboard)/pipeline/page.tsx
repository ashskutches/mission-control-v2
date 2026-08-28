"use client";
/**
 * Insights — one list, sorted however you need it.
 *
 * This replaced a four-column kanban (Inbox → Assigned → In Progress → Blocked)
 * spread over three pages plus a separate North Star briefing: ~3,900 lines to
 * render a board that holds ten items. The kanban's data source fanned four
 * tables into polymorphic cards so a finding and the work it spawned could sit
 * side by side, which duplicated /work and made "what should I do next?" a
 * question you answered by reading four columns.
 *
 * What replaced it:
 *  - **One row per insight.** Work items are not rows; an assigned insight
 *    carries its agent's progress inline, so acting on something never makes it
 *    disappear from the list you were reading.
 *  - **Sort by what you care about** — money, effort, risk, age, section.
 *  - **Assign to an agent or a person from the row**, which is the one part of
 *    the old pipeline that was pulling its weight.
 *  - **North Star's KPI strip on top**, because a ranked list of opportunities
 *    means nothing without the margin they are supposed to move.
 *
 * ## What is left here
 *
 * The list itself is `components/InsightsBoard` — the same component every space
 * renders on its own Insights tab, with no `section` prop so it shows all of them.
 * This page is that board plus the P&L strip, which is business-wide and therefore
 * does NOT belong on a space's tab: Marketing's insights are not judged on the
 * whole company's net margin.
 */
import React, { useState, useEffect } from "react";
import {
  ChevronRight, AlertTriangle, TrendingUp, Target, Activity, DollarSign, Lightbulb,
} from "lucide-react";
import InsightsBoard from "@/components/InsightsBoard";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";
const ACCENT = "#e98d20";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProfitSummary {
  netRevenue: number; netMarginPct: number | null; netProfit: number | null;
  grossMarginPct: number | null; mer: number | null; cac: number | null;
  cogsCoverage: number; coverageSufficient: boolean; orders: number; aov: number;
}
interface ProfitPacing { target: number; projectedTotal: number; varianceToPace: number; pctOfTarget: number }
/** A figure the P&L is withholding, and the one thing that would unblock it. */
interface ProfitBlocker { severity: string; message: string; fix: string }
interface Profit { summary: ProfitSummary; pacing: ProfitPacing | null; blockers: ProfitBlocker[] }

// ── KPI strip ─────────────────────────────────────────────────────────────────
// Carried over from North Star. A withheld figure renders as "—" with the reason
// underneath and is never filled with a placeholder — see /profitability.
function StatCard({ label, value, sub, icon: Icon, color = ACCENT, alert = false }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color?: string; alert?: boolean;
}) {
  return (
    <div style={{
      background: alert ? "rgba(244,63,94,0.07)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${alert ? "rgba(244,63,94,0.25)" : `${color}20`}`,
      borderRadius: 14, padding: "0.85rem 1.1rem", display: "flex", alignItems: "flex-start", gap: 12,
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: `${alert ? "#f43f5e" : color}18`, border: `1px solid ${alert ? "#f43f5e" : color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} color={alert ? "#f43f5e" : color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: "9.5px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0, fontWeight: 700 }}>{label}</p>
        <p style={{ fontSize: "1.25rem", fontWeight: 900, color: alert ? "#f43f5e" : "#e2e8f0", margin: "2px 0 0", lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: "9.5px", color: "#64748b", margin: "3px 0 0" }}>{sub}</p>}
      </div>
    </div>
  );
}

function KpiStrip({ profit }: { profit: Profit | null }) {
  const criticalBlockers = profit?.blockers?.filter(b => b.severity === "critical") ?? [];
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: "0.7rem", marginBottom: "0.6rem" }}>
        <StatCard
          label="Net Margin"
          value={profit?.summary.netMarginPct != null ? `${profit.summary.netMarginPct.toFixed(1)}%` : "—"}
          sub={profit?.summary.netProfit != null ? `$${Math.round(profit.summary.netProfit).toLocaleString()} QTD` : "needs unit costs + overhead"}
          icon={Target}
          color={profit?.summary.netMarginPct == null ? "#475569" : profit.summary.netMarginPct >= 0 ? "#22c55e" : "#f43f5e"}
          alert={profit?.summary.netMarginPct != null && profit.summary.netMarginPct < 0}
        />
        <StatCard
          label="Q Pace"
          value={profit?.pacing ? `$${Math.round(profit.pacing.projectedTotal / 1000)}K` : "—"}
          sub={profit?.pacing ? `of $${Math.round(profit.pacing.target / 1000)}K target` : "no target set"}
          icon={TrendingUp}
          color={!profit?.pacing ? "#475569" : profit.pacing.varianceToPace >= 0 ? "#22c55e" : "#f59e0b"}
          alert={!!profit?.pacing && profit.pacing.varianceToPace < 0}
        />
        <StatCard
          label="MER"
          value={profit?.summary.mer != null ? `${profit.summary.mer.toFixed(2)}×` : "—"}
          sub={profit?.summary.mer != null ? "revenue ÷ ad spend" : "no ad spend recorded"}
          icon={Activity}
          color={profit?.summary.mer == null ? "#475569" : profit.summary.mer >= 2.8 ? "#22c55e" : "#f43f5e"}
          alert={profit?.summary.mer != null && profit.summary.mer < 2.5}
        />
        <StatCard
          label="Gross Margin"
          value={profit?.summary.grossMarginPct != null ? `${profit.summary.grossMarginPct.toFixed(1)}%` : "—"}
          sub={profit?.summary.grossMarginPct != null ? "healthy ≥ 48%" : `only ${((profit?.summary.cogsCoverage ?? 0) * 100).toFixed(0)}% cost coverage`}
          icon={DollarSign}
          color={profit?.summary.grossMarginPct == null ? "#475569" : profit.summary.grossMarginPct >= 48 ? "#22c55e" : "#f59e0b"}
        />
      </div>
      {criticalBlockers.length > 0 && (
        <a href="/profitability?tab=costs" style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem", textDecoration: "none",
          background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 10, padding: "0.55rem 0.85rem",
        }}>
          <AlertTriangle size={13} color="#f43f5e" />
          <span style={{ fontSize: "11.5px", color: "#e2e8f0" }}>
            {criticalBlockers.length} blocker(s) are keeping the figures above from being real —{" "}
            <strong style={{ color: "#f43f5e" }}>{criticalBlockers[0]?.fix}</strong>
          </span>
          <ChevronRight size={12} color="#f43f5e" style={{ marginLeft: "auto", flexShrink: 0 }} />
        </a>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const [profit, setProfit] = useState<Profit | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${BOT_URL}/admin/profitability?period=qtd`).catch(() => null);
      if (res?.ok) setProfit(await res.json());
    })();
  }, []);

  return (
    <div style={{ padding: "1.25rem 1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.1rem" }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${ACCENT}18`, border: `1px solid ${ACCENT}35`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Lightbulb size={20} color={ACCENT} />
        </div>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: "1.4rem", color: "#e2e8f0", margin: 0, lineHeight: 1 }}>Insights</h1>
          <p style={{ fontSize: "0.75rem", color: "#475569", margin: 0, marginTop: 3 }}>
            Every space at once · sort it, assign it, watch it run
          </p>
        </div>
      </div>

      <KpiStrip profit={profit} />

      <InsightsBoard />
    </div>
  );
}
