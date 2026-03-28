"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  SearchCheck, TrendingUp, MousePointerClick, BarChart2,
  Percent, Star, RefreshCw, BrainCircuit, AlertTriangle, Lightbulb,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// ── Types ──────────────────────────────────────────────────────────────────

interface SEOStatus {
  gsc?: { configured: boolean; live_test: string | null; error: string | null; sample?: any };
  ga4?: { configured: boolean; live_test: string | null; error: string | null; sample?: any };
}

interface Insight {
  id: string;
  type: string;
  title: string;
  priority: number;
  estimated_monthly_value: number | null;
  difficulty: string | null;
  status: string;
  created_at: string;
}

// ── Helper components ──────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ElementType;
}) {
  return (
    <div className="column is-3-desktop is-6-tablet">
      <motion.div
        whileHover={{ y: -2 }}
        className="box p-4"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", height: "100%" }}
      >
        <div className="is-flex is-align-items-center mb-2" style={{ gap: "0.5rem" }}>
          <Icon size={15} color={color} />
          <span style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
            {label}
          </span>
        </div>
        <div style={{ fontSize: "1.5rem", fontWeight: 800, color }}>{value}</div>
        {sub && <div style={{ fontSize: "10px", color: "#475569", marginTop: "0.2rem" }}>{sub}</div>}
      </motion.div>
    </div>
  );
}

function StatusBadge({ test, label }: { test: string | null; label: string }) {
  const ok = test === "pass";
  return (
    <span className="tag is-rounded" style={{
      fontSize: "10px", fontWeight: 700,
      background: ok ? "rgba(34,197,94,0.12)" : test === "fail" ? "rgba(244,63,94,0.12)" : "rgba(255,255,255,0.05)",
      color: ok ? "#22c55e" : test === "fail" ? "#f43f5e" : "#94a3b8",
    }}>
      {ok ? "✓" : test === "fail" ? "✗" : "–"} {label}
    </span>
  );
}

const TYPE_COLOR: Record<string, string> = {
  critical_issue: "#f43f5e", suggestion: "#f59e0b",
  observation: "#38bdf8", competitor: "#a78bfa", win: "#22c55e",
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function SEOPage() {
  const [seoStatus, setSeoStatus] = useState<SEOStatus | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statusRes, insightsRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/seo/status`),
        fetch(`${BOT_URL}/admin/insights?section=seo&limit=8`),
      ]);
      if (statusRes.ok) setSeoStatus(await statusRes.json());
      if (insightsRes.ok) setInsights(await insightsRes.json());
    } catch (e) {
      console.error("SEO fetch error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const gsc = seoStatus?.gsc;
  const ga4 = seoStatus?.ga4;

  return (
    <div className="px-5 py-5" style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div className="is-flex is-justify-content-space-between is-align-items-flex-start mb-5">
        <div>
          <div className="is-flex is-align-items-center mb-1" style={{ gap: "0.75rem" }}>
            <SearchCheck size={22} color="#38bdf8" />
            <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.4rem" }}>SEO Command</h1>
          </div>
          <p className="has-text-grey-light" style={{ fontSize: "0.85rem" }}>
            Search Console · Analytics · Rankings · Opportunities
          </p>
        </div>
        <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
          {gsc && <StatusBadge test={gsc.live_test} label="GSC" />}
          {ga4 && <StatusBadge test={ga4.live_test} label="GA4" />}
          <button onClick={fetchData} className="button is-small is-ghost" style={{ color: "#64748b" }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="has-text-grey has-text-centered py-6">Loading SEO data...</p>
      ) : (
        <>
          {/* GSC KPIs */}
          {gsc?.live_test === "pass" && gsc.sample ? (
            <div className="mb-5">
              <p className="has-text-grey-light is-uppercase mb-3" style={{ fontSize: "10px", letterSpacing: "0.1em", fontWeight: 700 }}>
                Google Search Console · Last 7 Days
              </p>
              <div className="columns is-multiline">
                <KpiCard label="Total Clicks"       value={gsc.sample.total_clicks?.toLocaleString() ?? "–"} color="#38bdf8" icon={MousePointerClick} />
                <KpiCard label="Impressions"        value={gsc.sample.total_impressions?.toLocaleString() ?? "–"} color="#a78bfa" icon={BarChart2} />
                <KpiCard label="Avg CTR"            value={`${gsc.sample.ctr_pct ?? "–"}%`} color="#f59e0b" icon={Percent} />
                <KpiCard label="Avg Position"       value={gsc.sample.avg_position ?? "–"} color="#22c55e" icon={Star} />
              </div>
            </div>
          ) : gsc?.live_test === "fail" ? (
            <div className="notification mb-5" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)" }}>
              <p style={{ color: "#f43f5e", fontSize: "0.85rem" }}>
                <strong>GSC Error:</strong> {gsc.error}
              </p>
            </div>
          ) : null}

          {/* GA4 KPIs */}
          {ga4?.live_test === "pass" && ga4.sample ? (
            <div className="mb-5">
              <p className="has-text-grey-light is-uppercase mb-3" style={{ fontSize: "10px", letterSpacing: "0.1em", fontWeight: 700 }}>
                Google Analytics 4 · Last 7 Days
              </p>
              <div className="columns is-multiline">
                <KpiCard label="Sessions"   value={ga4.sample.sessions?.toLocaleString() ?? "–"} color="#38bdf8" icon={TrendingUp} />
                <KpiCard label="Users"      value={ga4.sample.users?.toLocaleString() ?? "–"} color="#f59e0b" icon={BarChart2} />
              </div>
            </div>
          ) : null}

          {/* SEO Insights */}
          <div className="mt-4">
            <div className="is-flex is-justify-content-space-between is-align-items-center mb-3">
              <p className="has-text-grey-light is-uppercase" style={{ fontSize: "10px", letterSpacing: "0.1em", fontWeight: 700 }}>
                SEO Intelligence ({insights.filter(i => i.status !== "dismissed").length})
              </p>
              <a href="/intelligence?section=seo" className="button is-small is-ghost" style={{ fontSize: "10px", color: "#64748b" }}>
                View all →
              </a>
            </div>

            {insights.length === 0 ? (
              <div className="box has-text-centered py-5" style={{ background: "rgba(255,255,255,0.02)" }}>
                <BrainCircuit size={28} color="#334155" style={{ margin: "0 auto 0.75rem" }} />
                <p className="has-text-grey" style={{ fontSize: "0.85rem" }}>
                  No SEO insights yet. Ask the SEO agent to run a research routine to start filing intelligence here.
                </p>
              </div>
            ) : (
              insights.filter(i => i.status !== "dismissed").slice(0, 6).map(insight => {
                const color = TYPE_COLOR[insight.type] ?? "#94a3b8";
                return (
                  <motion.div
                    key={insight.id}
                    whileHover={{ x: 2 }}
                    className="box mb-2 p-3"
                    style={{ background: "rgba(255,255,255,0.02)", borderLeft: `3px solid ${color}`, border: `1px solid ${color}20` }}
                  >
                    <div className="is-flex is-justify-content-space-between is-align-items-center">
                      <p className="has-text-white" style={{ fontWeight: 600, fontSize: "0.875rem" }}>{insight.title}</p>
                      <div className="is-flex is-align-items-center" style={{ gap: "0.5rem", flexShrink: 0 }}>
                        {insight.estimated_monthly_value != null && (
                          <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 700 }}>
                            +${Math.abs(insight.estimated_monthly_value).toLocaleString()}/mo
                          </span>
                        )}
                        <span style={{ fontSize: "10px", color, fontWeight: 700, textTransform: "uppercase" }}>
                          P{insight.priority}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
