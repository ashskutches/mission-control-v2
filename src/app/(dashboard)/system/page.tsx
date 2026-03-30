"use client";
import React from "react";
import { Wrench, Bug, Plug, DollarSign } from "lucide-react";
import AgentRequestsPanel from "@/components/AgentRequestsPanel";
import IntegrationsPanel from "@/components/IntegrationsPanel";
import CostSummaryPanel from "@/components/CostSummaryPanel";

function SectionHeader({ icon: Icon, color, title, subtitle }: {
  icon: any; color: string; title: string; subtitle: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: `rgba(${color},0.1)`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon size={13} style={{ color: `rgb(${color})` }} />
      </div>
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: "#f1f5f9", margin: 0, letterSpacing: "-0.01em" }}>
          {title}
        </h2>
        <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{subtitle}</p>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, padding: "18px 20px",
    }}>
      {children}
    </div>
  );
}

export default function SystemPage() {
  return (
    <div style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Wrench size={18} style={{ color: "#f43f5e" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", margin: 0, letterSpacing: "-0.02em" }}>
              System
            </h1>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
              Agent requests, costs, and integrations — your operations layer.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>

        {/* Agent Requests — full width, primary */}
        <Card>
          <SectionHeader
            icon={Bug}
            color="244,63,94"
            title="Agent Requests"
            subtitle="Bugs, missing integrations, feature gaps, and blockers filed by agents."
          />
          <AgentRequestsPanel />
        </Card>

        {/* Bottom 2-column row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          <Card>
            <SectionHeader
              icon={DollarSign}
              color="34,197,94"
              title="Cost Center"
              subtitle="30-day spend by agent and recent alert spikes."
            />
            <CostSummaryPanel />
          </Card>

          <Card>
            <SectionHeader
              icon={Plug}
              color="56,189,248"
              title="Integrations Registry"
              subtitle="All connected APIs — status, credentials, and agent tool mapping."
            />
            <IntegrationsPanel />
          </Card>

        </div>
      </div>
    </div>
  );
}
