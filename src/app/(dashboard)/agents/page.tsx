"use client";
import React, { useState, useEffect, useCallback } from "react";
import { AgentCRUD } from "@/components/AgentCRUD";
import { ChevronDown, ChevronUp, Brain, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

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

// ── Squad Lead roster — shown separately at top
function SquadLeadRoster() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/agents`);
      const data = await res.json();
      const all = Array.isArray(data) ? data : (data.agents ?? []);
      setLeads(all.filter((a: any) => a.category === "Squad Lead" || a.type === "manager"));
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  if (loading) return <p className="has-text-grey is-size-7">Loading...</p>;
  if (leads.length === 0) return (
    <div style={{ padding: "1.5rem", textAlign: "center", opacity: 0.5 }}>
      <Brain size={24} color="#a78bfa" style={{ margin: "0 auto 0.5rem" }} />
      <p className="has-text-grey" style={{ fontSize: 12 }}>
        No squad leads yet — click <strong>✨ Auto-Generate</strong> on any commerce department page to create one.
      </p>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
      {leads.map(agent => (
        <div
          key={agent.id}
          onClick={() => router.push(`/agents/${agent.id}`)}
          style={{
            display: "flex", alignItems: "center", gap: "0.85rem",
            padding: "0.85rem 1rem", borderRadius: 10, cursor: "pointer",
            background: "rgba(167,139,250,0.04)",
            border: `1px solid ${agent.color ?? "#a78bfa"}30`,
            borderLeft: `3px solid ${agent.color ?? "#a78bfa"}`,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.08)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.04)"; }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: `${agent.color ?? "#a78bfa"}18`,
            border: `1px solid ${agent.color ?? "#a78bfa"}30`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>
            {agent.emoji ?? "🧠"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "#e5e5e5", fontWeight: 900, fontSize: 13, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.name}</p>
            <p style={{ color: "#666", fontSize: 11, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.specialization}</p>
          </div>
          <ArrowRight size={13} color="#444" style={{ flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

export default function AgentsPage() {
  return (
    <div className="px-4 pb-6 pt-4">
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* ── Squad Leads — always visible at top ── */}
        <CollapsibleSection
          title="🧠 Squad Leads"
          subtitle="Auto-generated department heads — one per commerce section"
          defaultOpen={true}
        >
          <SquadLeadRoster />
        </CollapsibleSection>

        {/* ── Costs link ── */}
        <div style={{
          padding: "0.85rem 1.25rem", borderRadius: 12,
          border: "1px solid rgba(34,197,94,0.18)", background: "rgba(34,197,94,0.04)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13, margin: 0 }}>Agent Costs & ROI</p>
            <p style={{ color: "#475569", fontSize: 11, margin: "2px 0 0" }}>LLM spend, routine costs, and time-saved value have moved to their own page.</p>
          </div>
          <a href="/costs" style={{
            fontSize: 11, fontWeight: 700, color: "#22c55e",
            display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 7, padding: "5px 12px", textDecoration: "none",
          }}>
            View Costs →
          </a>
        </div>

        {/* ── All other agents ── */}
        <CollapsibleSection title="Manage Agents" subtitle="Create, configure, and deploy AI agents" defaultOpen={true}>
          <AgentCRUD />
        </CollapsibleSection>

      </div>
    </div>
  );
}
