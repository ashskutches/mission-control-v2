"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { RefreshCw, Clock, X, ThumbsDown } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

interface SectionMetric {
  id: string;
  section_id: string;
  agent_id: string;
  key: string;
  label: string;
  value: string;
  sub: string | null;
  color: string;
  icon: string;
  sort_order: number;
  updated_at: string;
}

interface SectionMetricsPanelProps {
  sectionId: string;
  agentName?: string;
  refreshTrigger?: number;
}

function getIcon(name: string): React.ElementType {
  const icon = (LucideIcons as any)[name];
  return icon ?? LucideIcons.BarChart2;
}

function MetricCard({
  metric,
  onDismiss,
  onReject,
}: {
  metric: SectionMetric;
  onDismiss: (key: string) => void;
  onReject: (key: string, label: string) => void;
}) {
  const Icon = getIcon(metric.icon);
  const [hovered, setHovered] = useState(false);
  const [acting, setActing] = useState<"dismiss" | "reject" | null>(null);
  const isPositive = metric.sub?.startsWith("↑") || metric.sub?.includes("+");
  const isNegative = metric.sub?.startsWith("↓") || metric.sub?.includes("-");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="box p-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${metric.color}20`,
        borderTop: `2px solid ${metric.color}`,
        flex: "1 1 150px",
        minWidth: 0,
        position: "relative",
      }}
    >
      {/* Hover action buttons */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              top: 5, right: 5,
              display: "flex", gap: 4,
            }}
          >
            {/* Dismiss — silently remove */}
            <button
              onClick={(e) => { e.stopPropagation(); setActing("dismiss"); onDismiss(metric.key); }}
              disabled={!!acting}
              aria-label="Dismiss metric"
              title="Dismiss (remove silently)"
              style={{
                width: 22, height: 22, borderRadius: 5, border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center",
                justifyContent: "center", cursor: "pointer", color: "#64748b",
                transition: "all 0.15s",
              }}
            >
              <X size={10} />
            </button>

            {/* Reject — remove + log + trigger agent reflection */}
            <button
              onClick={(e) => { e.stopPropagation(); setActing("reject"); onReject(metric.key, metric.label); }}
              disabled={!!acting}
              aria-label="Reject metric — agent will reflect"
              title="Reject (agent will learn from this)"
              style={{
                width: 22, height: 22, borderRadius: 5, border: "1px solid rgba(244,63,94,0.25)",
                background: "rgba(244,63,94,0.08)", display: "flex", alignItems: "center",
                justifyContent: "center", cursor: "pointer", color: "#f43f5e",
                transition: "all 0.15s",
              }}
            >
              <ThumbsDown size={10} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="is-flex is-align-items-center mb-2" style={{ gap: "0.4rem" }}>
        <Icon size={12} color={metric.color} />
        <span style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
          {metric.label}
        </span>
      </div>

      {/* Main value — smaller than before (was 1.45rem → now 1.05rem) */}
      <div style={{ fontSize: "1.05rem", fontWeight: 800, color: metric.color, lineHeight: 1, marginBottom: "0.25rem" }}>
        {acting === "dismiss" ? <span style={{ color: "#475569", fontSize: "0.75rem" }}>Removing…</span>
         : acting === "reject" ? <span style={{ color: "#f43f5e", fontSize: "0.75rem" }}>Rejected ✓</span>
         : metric.value}
      </div>

      {metric.sub && !acting && (
        <div style={{
          fontSize: "9px", fontWeight: 600,
          color: isPositive ? "#22c55e" : isNegative ? "#f43f5e" : "#64748b",
        }}>
          {metric.sub}
        </div>
      )}
    </motion.div>
  );
}

export default function SectionMetricsPanel({ sectionId, agentName, refreshTrigger }: SectionMetricsPanelProps) {
  const [metrics, setMetrics] = useState<SectionMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/section-metrics?section=${sectionId}`);
      if (res.ok) {
        const data: SectionMetric[] = await res.json();
        setMetrics(data.sort((a, b) => a.sort_order - b.sort_order));
        if (data.length > 0) {
          const latest = data.reduce((a, b) => new Date(a.updated_at) > new Date(b.updated_at) ? a : b);
          setLastUpdated(latest.updated_at);
        }
      }
    } catch (e) {
      console.error("Failed to fetch section metrics", e);
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics, refreshTrigger]);

  const handleFeedback = async (key: string, action: "dismiss" | "reject", label?: string) => {
    // Optimistic remove from UI immediately
    const metric = metrics.find(m => m.key === key);
    setMetrics(prev => prev.filter(m => m.key !== key));

    try {
      await fetch(`${BOT_URL}/admin/section-metrics/${sectionId}/${encodeURIComponent(key)}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          label: label ?? key,
          agent_id: metric?.agent_id,
        }),
      });
    } catch {
      // Non-fatal; metric already removed from UI
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) return null;

  if (metrics.length === 0) {
    return (
      <div className="mb-4 px-1">
        <p style={{ fontSize: "11px", color: "#334155", fontStyle: "italic" }}>
          No metrics yet — agent will create dashboard widgets after running analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <div className="is-flex is-justify-content-space-between is-align-items-center mb-3">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <p style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, margin: 0 }}>
            Analytics
          </p>
          <span style={{ fontSize: "9px", color: "#334155" }} title="Hover a card to dismiss or reject it">· hover to manage</span>
        </div>
        <div className="is-flex is-align-items-center" style={{ gap: "0.4rem" }}>
          {lastUpdated && (
            <span style={{ fontSize: "10px", color: "#475569", display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Clock size={10} />
              {agentName ? `${agentName} · ` : ""}{timeAgo(lastUpdated)}
            </span>
          )}
          <button onClick={fetchMetrics} className="button is-small is-ghost" style={{ color: "#475569", padding: "0 4px" }}>
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
        <AnimatePresence mode="popLayout">
          {metrics.map(metric => (
            <MetricCard
              key={metric.key}
              metric={metric}
              onDismiss={(k) => handleFeedback(k, "dismiss", metric.label)}
              onReject={(k, l) => handleFeedback(k, "reject", l)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
