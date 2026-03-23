"use client";
import React, { useState } from "react";
import { AgentCRUD } from "@/components/AgentCRUD";
import AgentMetrics from "@/components/AgentMetrics";
import { ChevronDown, ChevronUp } from "lucide-react";

function CollapsibleSection({ title, subtitle, defaultOpen = false, children }: { title: string; subtitle?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", background: open ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)", border: "none", cursor: "pointer", borderBottom: open ? "1px solid rgba(255,255,255,0.07)" : "none" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
        onMouseLeave={e => (e.currentTarget.style.background = open ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)")}>
        <div style={{ textAlign: "left" }}>
          <p className="has-text-weight-black has-text-white" style={{ fontSize: 15 }}>{title}</p>
          {subtitle && <p className="has-text-grey" style={{ fontSize: 11, marginTop: 2 }}>{subtitle}</p>}
        </div>
        {open ? <ChevronUp size={16} color="#666" /> : <ChevronDown size={16} color="#666" />}
      </button>
      {open && <div style={{ padding: "1.25rem" }}>{children}</div>}
    </div>
  );
}

export default function AgentsPage() {
  return (
    <div className="px-4 pb-6 pt-4">
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <CollapsibleSection title="Agent Intelligence" subtitle="Performance · Cost · ROI — 30 Day Window" defaultOpen={false}>
          <AgentMetrics />
        </CollapsibleSection>
        <CollapsibleSection title="Manage Agents" subtitle="Create, configure, and deploy AI agents" defaultOpen={true}>
          <AgentCRUD />
        </CollapsibleSection>
      </div>
    </div>
  );
}
