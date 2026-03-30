"use client";
import React, { useEffect, useState, useCallback } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, Activity, Zap, Clock,
  CheckCircle, RefreshCw, BarChart3, Award, AlertTriangle, Bot,
  ShoppingBag, Plug, Server,
} from "lucide-react";
import AgentMetrics from "@/components/AgentMetrics";
import CostAlertsPanel from "@/components/CostAlertsPanel";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

// ── API Cost Entry (placeholder for future real tracking)
interface ApiCostEntry {
  name: string;
  icon: string;
  costEstimate: string;
  period: string;
  note: string;
  color: string;
  status: "tracked" | "estimated" | "coming_soon";
}

const API_COSTS: ApiCostEntry[] = [
  { name: "Anthropic (LLM)", icon: "🤖", costEstimate: "See agent breakdown →", period: "30d", note: "Tracked in cost_log via agent runs", color: "#a78bfa", status: "tracked" },
  { name: "OpenAI (GPT-4o / Whisper)", icon: "⚡", costEstimate: "See agent breakdown →", period: "30d", note: "Used for fallback tasks and voice transcription", color: "#38bdf8", status: "tracked" },
  { name: "Shopify", icon: "🛍️", costEstimate: "$179/mo", period: "fixed", note: "Advanced plan — includes API access", color: "#10b981", status: "estimated" },
  { name: "Klaviyo", icon: "📧", costEstimate: "~$150–$300/mo", period: "usage", note: "Scales with contact count + sends", color: "#fb923c", status: "estimated" },
  { name: "Google Ads / Meta Ads", icon: "📢", costEstimate: "Budget-dependent", period: "variable", note: "Not agent spend — ad budget tracked separately", color: "#f59e0b", status: "estimated" },
  { name: "DataForSEO", icon: "🔍", costEstimate: "Pay-per-use", period: "usage", note: "Keyword ranking, SERP, and backlink data calls", color: "#34d399", status: "coming_soon" },
  { name: "Twilio (SMS / Voice)", icon: "📱", costEstimate: "~$0.008/SMS", period: "per-use", note: "Only charged when agents trigger SMS or calls", color: "#e879f9", status: "coming_soon" },
  { name: "Firecrawl", icon: "🕷️", costEstimate: "Pay-per-use", period: "usage", note: "Web scraping credits consumed by SEO and research agents", color: "#f43f5e", status: "coming_soon" },
];

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  tracked:      { label: "Tracked",     bg: "rgba(167,139,250,0.15)", color: "#a78bfa" },
  estimated:    { label: "Estimated",   bg: "rgba(245,158,11,0.15)",  color: "#f59e0b" },
  coming_soon:  { label: "Coming Soon", bg: "rgba(100,116,139,0.15)", color: "#64748b" },
};

export default function CostsPage() {
  return (
    <div className="px-4 pb-8 pt-4" style={{ maxWidth: 1200, margin: "0 auto" }}>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: "2.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <DollarSign size={22} color="#22c55e" />
          </div>
          <div>
            <h1 className="has-text-white" style={{ fontWeight: 900, fontSize: "1.5rem", lineHeight: 1 }}>
              Costs & ROI
            </h1>
            <p className="has-text-grey-light" style={{ fontSize: "0.8rem", marginTop: 4, maxWidth: 520 }}>
              Every dollar the agent system spends, tracked. LLM compute, API usage, and time-value estimates — all in one place.
            </p>
          </div>
        </div>
        <div style={{
          padding: "0.6rem 1rem", borderRadius: 8, marginTop: "0.75rem",
          background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)",
          display: "inline-flex", alignItems: "center", gap: 8,
        }}>
          <Activity size={12} color="#22c55e" />
          <p style={{ fontSize: 11, color: "#86efac" }}>
            <strong>Cost discipline matters.</strong> Every routine run, tool call, and LLM response is logged. Use this page to find waste, justify spend, and optimize costly workflows.
          </p>
        </div>
      </div>

      {/* ── Cost Alerts Panel ── */}
      <div style={{ marginBottom: "2.5rem" }}>
        <CostAlertsPanel />
      </div>

      {/* ── Agent LLM Metrics (full component) ── */}
      <div style={{ marginBottom: "2.5rem" }}>
        <AgentMetrics />
      </div>

      {/* ── External API Costs ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.25rem" }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Plug size={14} color="#38bdf8" />
          </div>
          <div>
            <p style={{ fontWeight: 800, color: "#e2e8f0", fontSize: 13, margin: 0, lineHeight: 1 }}>External API & Platform Costs</p>
            <p style={{ fontSize: 10, color: "#475569", margin: 0, marginTop: 3 }}>Third-party integrations — some tracked, some estimated, some coming soon</p>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "0.75rem",
        }}>
          {API_COSTS.map(entry => {
            const badge = STATUS_BADGE[entry.status]!;
            return (
              <div key={entry.name} style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${entry.color}25`,
                borderLeft: `3px solid ${entry.color}`,
                borderRadius: 10, padding: "0.85rem 1rem",
                display: "flex", gap: "0.85rem", alignItems: "flex-start",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: `${entry.color}12`, border: `1px solid ${entry.color}25`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18,
                }}>
                  {entry.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <p style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 13, margin: 0 }}>{entry.name}</p>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                      padding: "2px 7px", borderRadius: 10,
                      background: badge.bg, color: badge.color,
                    }}>
                      {badge.label}
                    </span>
                  </div>
                  <p style={{ color: "#22c55e", fontWeight: 700, fontSize: 13, margin: "0 0 4px" }}>
                    {entry.costEstimate}
                    <span style={{ color: "#475569", fontWeight: 400, fontSize: 10, marginLeft: 6 }}>{entry.period}</span>
                  </p>
                  <p style={{ color: "#64748b", fontSize: 10, margin: 0, lineHeight: 1.4 }}>{entry.note}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div style={{
          marginTop: "1.25rem", padding: "0.75rem 1rem", borderRadius: 8,
          background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#64748b", fontWeight: 700 }}>📌 Roadmap:</span>{" "}
            Full API cost tracking (Twilio, DataForSEO, Firecrawl, Shopify API overage) is on the roadmap. Each agent will eventually log the cost of each external call to the <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4, fontSize: 10 }}>cost_log</code> table for unified reporting.
          </p>
        </div>
      </div>

    </div>
  );
}
