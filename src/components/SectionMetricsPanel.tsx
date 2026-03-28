"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { RefreshCw, Clock } from "lucide-react";

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
  refreshTrigger?: number; // increment to force refresh
}

function getIcon(name: string): React.ElementType {
  const icon = (LucideIcons as any)[name];
  return icon ?? LucideIcons.BarChart2;
}

function MetricCard({ metric }: { metric: SectionMetric }) {
  const Icon = getIcon(metric.icon);
  const isPositive = metric.sub?.startsWith("↑") || metric.sub?.includes("+");
  const isNegative = metric.sub?.startsWith("↓") || metric.sub?.includes("-");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="box p-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${metric.color}20`,
        borderTop: `2px solid ${metric.color}`,
        flex: "1 1 160px",
        minWidth: 0,
      }}
    >
      <div className="is-flex is-align-items-center mb-2" style={{ gap: "0.4rem" }}>
        <Icon size={13} color={metric.color} />
        <span style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
          {metric.label}
        </span>
      </div>
      <div style={{ fontSize: "1.45rem", fontWeight: 800, color: metric.color, lineHeight: 1, marginBottom: "0.3rem" }}>
        {metric.value}
      </div>
      {metric.sub && (
        <div style={{
          fontSize: "10px", fontWeight: 600,
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

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) return null; // silently wait; SectionAgentPanel shows loading state

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
        <p style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
          Analytics
        </p>
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        {metrics.map(metric => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </div>
    </div>
  );
}
