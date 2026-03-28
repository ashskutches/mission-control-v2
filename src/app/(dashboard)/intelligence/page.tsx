"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit, AlertTriangle, Lightbulb, Eye, Users, Trophy,
  TrendingUp, Clock, ChevronDown, ChevronUp, ExternalLink, RefreshCw,
  Filter,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// ── Types ──────────────────────────────────────────────────────────────────

type InsightType = "observation" | "critical_issue" | "suggestion" | "competitor" | "win";
type InsightStatus = "new" | "acknowledged" | "in_progress" | "resolved" | "dismissed";
type Section = "all" | "seo" | "email" | "content" | "ads" | "product" | "general";

interface Insight {
  id: string;
  created_at: string;
  agent_name: string | null;
  section: string;
  type: InsightType;
  title: string;
  body: string | null;
  priority: number;
  status: InsightStatus;
  estimated_monthly_value: number | null;
  difficulty: string | null;
  effort: string | null;
  metrics: Record<string, any>;
  week_key: string | null;
}

interface Summary {
  total: number;
  criticalNew: number;
  totalEstimatedMonthlyValue: number;
  byType: Record<string, number>;
  bySection: Record<string, number>;
}

// ── Config ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<InsightType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  critical_issue: { label: "Critical", icon: AlertTriangle, color: "#f43f5e", bg: "rgba(244,63,94,0.12)" },
  suggestion:     { label: "Suggestion", icon: Lightbulb, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  observation:    { label: "Observation", icon: Eye, color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  competitor:     { label: "Competitor", icon: Users, color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  win:            { label: "Win", icon: Trophy, color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
};

const STATUS_NEXT: Record<InsightStatus, InsightStatus | null> = {
  new: "acknowledged", acknowledged: "in_progress", in_progress: "resolved", resolved: null, dismissed: null,
};

const STATUS_LABEL: Record<InsightStatus, string> = {
  new: "New", acknowledged: "Acknowledged", in_progress: "In Progress", resolved: "Resolved", dismissed: "Dismissed",
};

const STATUS_COLOR: Record<InsightStatus, string> = {
  new: "#f59e0b", acknowledged: "#38bdf8", in_progress: "#a78bfa", resolved: "#22c55e", dismissed: "#64748b",
};

const PRIORITY_BAR_COLOR = (p: number) =>
  p >= 8 ? "#f43f5e" : p >= 6 ? "#f59e0b" : p >= 4 ? "#38bdf8" : "#64748b";

const DIFFICULTY_COLOR: Record<string, string> = { easy: "#22c55e", medium: "#f59e0b", hard: "#f43f5e" };
const EFFORT_COLOR: Record<string, string>     = { low: "#22c55e", medium: "#f59e0b", high: "#f43f5e" };

const SECTION_LABELS: Record<string, string> = {
  seo: "SEO", email: "Email", content: "Content",
  ads: "Ads", product: "Product", general: "General",
};

// ── Sub-components ──────────────────────────────────────────────────────────

function SummaryBar({ summary }: { summary: Summary }) {
  return (
    <div className="columns is-multiline mb-5">
      {[
        { label: "Total Insights", value: summary.total, color: "#38bdf8", icon: BrainCircuit },
        { label: "🔴 Critical (New)", value: summary.criticalNew, color: "#f43f5e", icon: AlertTriangle },
        { label: "Est. Monthly Value", value: `$${(summary.totalEstimatedMonthlyValue ?? 0).toLocaleString()}`, color: "#22c55e", icon: TrendingUp },
        { label: "Sections Active", value: Object.keys(summary.bySection ?? {}).length, color: "#a78bfa", icon: Filter },
      ].map(({ label, value, color, icon: Icon }) => (
        <div key={label} className="column is-3-desktop is-6-tablet">
          <div className="box p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="is-flex is-align-items-center" style={{ gap: "0.6rem", marginBottom: "0.4rem" }}>
              <Icon size={15} color={color} />
              <span style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</span>
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color }}>{value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightCard({ insight, onStatusChange, onDismiss }: {
  insight: Insight;
  onStatusChange: (id: string, status: InsightStatus) => void;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tc = TYPE_CONFIG[insight.type] ?? TYPE_CONFIG.observation;
  const Icon = tc.icon;
  const nextStatus = STATUS_NEXT[insight.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="box mb-3 p-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${tc.color}28`,
        borderLeft: `3px solid ${tc.color}`,
      }}
    >
      {/* Header row */}
      <div className="is-flex is-align-items-flex-start" style={{ gap: "0.75rem" }}>
        {/* Type icon */}
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: tc.bg, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={17} color={tc.color} />
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges */}
          <div className="is-flex is-flex-wrap-wrap" style={{ gap: "0.4rem", marginBottom: "0.4rem" }}>
            <span className="tag is-rounded" style={{ fontSize: "9px", background: tc.bg, color: tc.color, fontWeight: 700, textTransform: "uppercase" }}>
              {tc.label}
            </span>
            <span className="tag is-rounded" style={{ fontSize: "9px", background: "rgba(255,255,255,0.05)", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>
              {SECTION_LABELS[insight.section] ?? insight.section}
            </span>
            <span className="tag is-rounded" style={{ fontSize: "9px", background: `${STATUS_COLOR[insight.status]}18`, color: STATUS_COLOR[insight.status], fontWeight: 700 }}>
              {STATUS_LABEL[insight.status]}
            </span>
            {insight.agent_name && (
              <span className="tag is-rounded" style={{ fontSize: "9px", background: "rgba(255,255,255,0.04)", color: "#64748b" }}>
                {insight.agent_name}
              </span>
            )}
          </div>

          {/* Title */}
          <p className="has-text-white" style={{ fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.3, marginBottom: "0.5rem" }}>
            {insight.title}
          </p>

          {/* Metrics row */}
          <div className="is-flex is-flex-wrap-wrap" style={{ gap: "1rem", marginBottom: "0.5rem" }}>
            {/* Priority */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <div style={{ width: 56, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${insight.priority * 10}%`, height: "100%", background: PRIORITY_BAR_COLOR(insight.priority), borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: "10px", color: "#94a3b8" }}>P{insight.priority}</span>
            </div>
            {/* Value */}
            {insight.estimated_monthly_value != null && (
              <span style={{ fontSize: "11px", color: insight.estimated_monthly_value >= 0 ? "#22c55e" : "#f43f5e", fontWeight: 700 }}>
                💰 {insight.estimated_monthly_value >= 0 ? "+" : ""}${Math.abs(insight.estimated_monthly_value).toLocaleString()}/mo
              </span>
            )}
            {/* Difficulty */}
            {insight.difficulty && (
              <span style={{ fontSize: "10px", color: DIFFICULTY_COLOR[insight.difficulty] ?? "#94a3b8", fontWeight: 600 }}>
                Difficulty: {insight.difficulty}
              </span>
            )}
            {/* Effort */}
            {insight.effort && (
              <span style={{ fontSize: "10px", color: EFFORT_COLOR[insight.effort] ?? "#94a3b8", fontWeight: 600 }}>
                Effort: {insight.effort}
              </span>
            )}
            {/* Date */}
            <span style={{ fontSize: "10px", color: "#475569", display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={10} />
              {new Date(insight.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Expand toggle */}
        {insight.body && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="button is-ghost is-small"
            style={{ color: "#64748b", padding: "0.25rem" }}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {/* Expanded body */}
      <AnimatePresence>
        {expanded && insight.body && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="has-text-grey-light" style={{ fontSize: "0.875rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {insight.body}
              </p>
              {/* Supporting metrics */}
              {Object.keys(insight.metrics ?? {}).length > 0 && (
                <div className="mt-3 is-flex is-flex-wrap-wrap" style={{ gap: "0.5rem" }}>
                  {Object.entries(insight.metrics).map(([k, v]) => (
                    <span key={k} className="tag" style={{ fontSize: "10px", background: "rgba(255,255,255,0.04)", color: "#94a3b8" }}>
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="is-flex is-align-items-center mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", gap: "0.5rem" }}>
        {nextStatus && (
          <button
            onClick={() => onStatusChange(insight.id, nextStatus)}
            className="button is-small"
            style={{ background: `${STATUS_COLOR[nextStatus]}18`, color: STATUS_COLOR[nextStatus], border: `1px solid ${STATUS_COLOR[nextStatus]}30`, fontSize: "11px", fontWeight: 700 }}
          >
            → {STATUS_LABEL[nextStatus]}
          </button>
        )}
        <a
          href={`/chats?agent=${insight.agent_name ?? ""}&context=${encodeURIComponent(`[Insight: ${insight.title}] Let's work on this.`)}`}
          className="button is-small is-ghost"
          style={{ color: "#64748b", fontSize: "11px", gap: "0.3rem" }}
        >
          <ExternalLink size={12} /> Chat about this
        </a>
        {insight.status !== "dismissed" && (
          <button
            onClick={() => onDismiss(insight.id)}
            className="button is-small is-ghost ml-auto"
            style={{ color: "#475569", fontSize: "11px" }}
          >
            Dismiss
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

const TYPE_TABS = [
  { id: "all", label: "All" },
  { id: "critical_issue", label: "🔴 Critical" },
  { id: "suggestion", label: "💡 Suggestions" },
  { id: "observation", label: "👁 Observations" },
  { id: "competitor", label: "🔬 Competitor" },
  { id: "win", label: "🏆 Wins" },
];

const SECTION_FILTERS: { id: Section; label: string }[] = [
  { id: "all", label: "All Sections" },
  { id: "seo", label: "SEO" },
  { id: "email", label: "Email" },
  { id: "content", label: "Content" },
  { id: "ads", label: "Ads" },
  { id: "product", label: "Product" },
  { id: "general", label: "General" },
];

export default function IntelligencePage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState("all");
  const [activeSection, setActiveSection] = useState<Section>("all");
  const [sortBy, setSortBy] = useState<"priority" | "value" | "date">("priority");
  const [showResolved, setShowResolved] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (activeType !== "all") params.set("type", activeType);
      if (activeSection !== "all") params.set("section", activeSection);

      const [insRes, sumRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/insights?${params}`),
        fetch(`${BOT_URL}/admin/insights/summary`),
      ]);

      if (insRes.ok) setInsights(await insRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch (e) {
      console.error("Failed to fetch insights", e);
    } finally {
      setLoading(false);
    }
  }, [activeType, activeSection]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (id: string, status: InsightStatus) => {
    await fetch(`${BOT_URL}/admin/insights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setInsights(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const dismiss = async (id: string) => {
    await fetch(`${BOT_URL}/admin/insights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
    setInsights(prev => prev.filter(i => i.id !== id));
  };

  const filtered = insights
    .filter(i => showResolved || (i.status !== "resolved" && i.status !== "dismissed"))
    .sort((a, b) => {
      if (sortBy === "priority") return b.priority - a.priority;
      if (sortBy === "value") return (b.estimated_monthly_value ?? 0) - (a.estimated_monthly_value ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="px-5 py-5" style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div className="is-flex is-justify-content-space-between is-align-items-center mb-5">
        <div>
          <div className="is-flex is-align-items-center" style={{ gap: "0.75rem", marginBottom: "0.25rem" }}>
            <BrainCircuit size={22} color="#f59e0b" />
            <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.4rem" }}>
              Intelligence Board
            </h1>
          </div>
          <p className="has-text-grey-light" style={{ fontSize: "0.85rem" }}>
            Agent-surfaced observations, risks, and opportunities across all business domains.
          </p>
        </div>
        <button onClick={fetchData} className="button is-small is-ghost" style={{ color: "#64748b" }}>
          <RefreshCw size={14} className={loading ? "spin" : ""} />
        </button>
      </div>

      {/* Summary bar */}
      {summary && <SummaryBar summary={summary} />}

      {/* Type tabs */}
      <div className="is-flex is-flex-wrap-wrap mb-4" style={{ gap: "0.4rem" }}>
        {TYPE_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveType(t.id)}
            className="button is-small"
            style={{
              background: activeType === t.id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
              color: activeType === t.id ? "#f59e0b" : "#94a3b8",
              border: activeType === t.id ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(255,255,255,0.06)",
              fontWeight: 700, fontSize: "11px",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Section filter + sort */}
      <div className="is-flex is-justify-content-space-between is-align-items-center mb-4 is-flex-wrap-wrap" style={{ gap: "0.5rem" }}>
        <div className="is-flex" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
          {SECTION_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveSection(f.id)}
              className="button is-small"
              style={{
                background: activeSection === f.id ? "rgba(56,189,248,0.12)" : "transparent",
                color: activeSection === f.id ? "#38bdf8" : "#64748b",
                border: activeSection === f.id ? "1px solid rgba(56,189,248,0.25)" : "1px solid transparent",
                fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
          <span style={{ fontSize: "10px", color: "#475569", textTransform: "uppercase" }}>Sort:</span>
          {(["priority", "value", "date"] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)} className="button is-small is-ghost"
              style={{ fontSize: "10px", fontWeight: 700, color: sortBy === s ? "#f59e0b" : "#64748b", textTransform: "capitalize" }}>
              {s}
            </button>
          ))}
          <label style={{ fontSize: "10px", color: "#475569", display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}>
            <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} />
            Resolved
          </label>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <p className="has-text-grey has-text-centered py-6">Loading intelligence...</p>
      ) : filtered.length === 0 ? (
        <div className="box has-text-centered py-6" style={{ background: "rgba(255,255,255,0.02)" }}>
          <BrainCircuit size={32} color="#334155" style={{ margin: "0 auto 1rem" }} />
          <p className="has-text-grey">No insights yet — agents will file them as they research.</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {filtered.map(insight => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onStatusChange={updateStatus}
              onDismiss={dismiss}
            />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
