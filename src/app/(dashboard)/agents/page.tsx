"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AgentCRUD } from "@/components/AgentCRUD";
import {
  LayoutDashboard, Users, Bot, ListTodo,
  Zap, MessageSquare, BarChart2, Clock,
  ArrowRight, RefreshCw, ChevronRight,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AgentDef {
  id: string; name: string; type: string; specialization: string;
  discordChannelId: string; role?: string; emoji?: string; color?: string;
  category?: string; mission?: string;
  action_perms?: { email?: boolean; sms?: boolean; social?: boolean; calls?: boolean };
}

// ── Category helpers (mirrors AgentCRUD) ──────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  "Squad Lead": "#a78bfa", Design: "#ff6b9d", Engineering: "#4da6ff",
  Marketing: "#ff8c00", "Paid Media": "#a855f7", Product: "#22c55e",
  "Project Management": "#06b6d4", Testing: "#f59e0b", Support: "#10b981",
  Specialized: "#e879f9", Influencing: "#f43f5e", Organics: "#84cc16", General: "#6366f1",
};
const SPEC_MAP: [RegExp, string][] = [
  [/seo|search engine|content market|blog|keyword|organic/i, "Organics"],
  [/reddit|grayhat|grey.?hat|forum|community post|upvot/i, "Organics"],
  [/influenc|ugc|creator|tiktok|instagram|youtube|collab|partnership|ambassador/i, "Influencing"],
  [/email|campaign|social|brand|advertis|copywr|outreach|growth/i, "Marketing"],
  [/paid|ppc|ads|google ads|meta ads|facebook ads|tiktok ads/i, "Paid Media"],
  [/design|ui|ux|figma|creative|graphic|photo|visual|illustrat/i, "Design"],
  [/engineer|dev|code|software|frontend|backend|fullstack|api|database|devops/i, "Engineering"],
  [/product|roadmap|feature|backlog|sprint|agile|scrum/i, "Product"],
  [/project|pm|planning|milestone|timeline|coordinat/i, "Project Management"],
  [/test|qa|quality|bug|automat|spec|coverage/i, "Testing"],
  [/support|customer|helpdesk|ticket|service|care/i, "Support"],
];
function deriveCategory(a: AgentDef): string {
  if (a.category && CATEGORY_COLORS[a.category]) return a.category;
  const h = `${a.specialization ?? ""} ${a.mission ?? ""}`;
  for (const [re, cat] of SPEC_MAP) if (re.test(h)) return cat;
  return "General";
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview", label: "Overview",  icon: LayoutDashboard },
  { id: "leads",    label: "Leads",     icon: Users },
  { id: "agents",   label: "Agents",    icon: Bot },
  { id: "tasks",    label: "Tasks",     icon: ListTodo },
] as const;
type TabId = typeof TABS[number]["id"];

function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <div style={{
      display: "flex", gap: 0,
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      marginBottom: "1.5rem", flexShrink: 0,
    }}>
      {TABS.map(tab => {
        const isActive = active === tab.id;
        const Icon = tab.icon;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)} style={{
            display: "flex", alignItems: "center", gap: "0.45rem",
            padding: "0.6rem 1.1rem",
            background: "none", border: "none",
            borderBottom: isActive ? "2px solid #e98d20" : "2px solid transparent",
            marginBottom: -1,
            color: isActive ? "#e98d20" : "#475569",
            fontWeight: isActive ? 800 : 500,
            fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em",
            cursor: "pointer", transition: "color 0.15s", fontFamily: "inherit",
          }}>
            <Icon size={13} />{tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab({ agents, metrics }: { agents: AgentDef[]; metrics: any }) {
  const leads = agents.filter(a => deriveCategory(a) === "Squad Lead");
  const workers = agents.filter(a => deriveCategory(a) !== "Squad Lead");

  const statCards = [
    { label: "Total Agents",    value: agents.length,               color: "#e98d20", icon: Bot },
    { label: "Lead Agents",     value: leads.length,                color: "#a78bfa", icon: Users },
    { label: "Routines Active", value: metrics?.routines ?? "—",    color: "#22c55e", icon: Zap },
    { label: "30-Day Runs",     value: metrics?.totalRuns ?? "—",   color: "#4a9eff", icon: BarChart2 },
    { label: "Total Cost",      value: metrics?.totalCost ? `$${Number(metrics.totalCost).toFixed(2)}` : "—", color: "#f59e0b", icon: Clock },
    { label: "Conversations",   value: metrics?.conversations ?? "—", color: "#e879f9", icon: MessageSquare },
  ];

  // Group workers by category
  const byDept: Record<string, AgentDef[]> = {};
  for (const a of workers) {
    const d = deriveCategory(a);
    (byDept[d] ??= []).push(a);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderLeft: `3px solid ${card.color}`, borderRadius: 10, padding: "0.85rem 1rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Icon size={13} color={card.color} />
                <span style={{ fontSize: 9, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>{card.label}</span>
              </div>
              <p style={{ fontSize: 22, fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1 }}>{card.value}</p>
            </div>
          );
        })}
      </div>



      {/* Dept breakdown */}
      <div>
        <p style={{ fontSize: 9, fontWeight: 800, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 10px" }}>
          Department Breakdown
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.5rem" }}>
          {Object.entries(byDept).map(([dept, dAgents]) => {
            const color = CATEGORY_COLORS[dept] ?? "#6366f1";
            return (
              <div key={dept} style={{
                background: `${color}08`, border: `1px solid ${color}20`,
                borderRadius: 10, padding: "0.75rem 1rem",
                display: "flex", alignItems: "center", gap: "0.75rem",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: color, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{dept}</p>
                  <p style={{ fontSize: 10, color: "#475569", margin: "2px 0 0" }}>{dAgents.length} agent{dAgents.length !== 1 ? "s" : ""}</p>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 80, justifyContent: "flex-end" }}>
                  {dAgents.slice(0, 4).map(a => (
                    <span key={a.id} title={a.name} style={{ fontSize: 14 }}>{a.emoji ?? "🤖"}</span>
                  ))}
                  {dAgents.length > 4 && <span style={{ fontSize: 9, color: "#475569" }}>+{dAgents.length - 4}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent Costs link */}
      <div style={{
        padding: "0.85rem 1.25rem", borderRadius: 12,
        border: "1px solid rgba(34,197,94,0.18)", background: "rgba(34,197,94,0.04)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13, margin: 0 }}>Agent Costs & ROI</p>
          <p style={{ color: "#475569", fontSize: 11, margin: "2px 0 0" }}>LLM spend, routine costs, and time-saved value.</p>
        </div>
        <a href="/costs" style={{
          fontSize: 11, fontWeight: 700, color: "#22c55e",
          display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
          background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
          borderRadius: 7, padding: "5px 12px", textDecoration: "none",
        }}>View Costs →</a>
      </div>
    </div>
  );
}

function LeadMiniCard({ agent }: { agent: AgentDef }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const color = "#a78bfa";
  return (
    <div
      onClick={() => router.push(`/agents/${agent.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        background: hovered ? "rgba(167,139,250,0.07)" : "rgba(167,139,250,0.03)",
        border: `1px solid ${hovered ? "rgba(167,139,250,0.3)" : "rgba(167,139,250,0.12)"}`,
        borderLeft: "3px solid #a78bfa", borderRadius: 10, padding: "0.65rem 0.9rem",
        cursor: "pointer", transition: "all 0.15s",
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>{agent.emoji ?? "🧠"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 12, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.name}</p>
        <p style={{ color: "#475569", fontSize: 10, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.specialization}</p>
      </div>
      <ChevronRight size={13} color={hovered ? color : "#334155"} style={{ flexShrink: 0, transition: "color 0.15s" }} />
    </div>
  );
}

// ── Leads tab ─────────────────────────────────────────────────────────────────
function LeadsTab({ agents }: { agents: AgentDef[]; allAgents?: AgentDef[] }) {
  const leads = agents.filter(a => deriveCategory(a) === "Squad Lead");

  if (leads.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem", gap: 12, opacity: 0.5 }}>
        <Users size={32} color="#475569" />
        <p style={{ fontSize: 13, color: "#475569", textAlign: "center" }}>No lead agents found.<br />Create an agent with the &quot;Squad Lead&quot; category to see them here.</p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 9, fontWeight: 800, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 10px" }}>
        Lead Agents
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.6rem" }}>
        {leads.map(a => (
          <LeadMiniCard key={a.id} agent={a} />
        ))}
      </div>
    </div>
  );
}


// ── Tasks placeholder ─────────────────────────────────────────────────────────
function TasksTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6rem 2rem", gap: 16, opacity: 0.5 }}>
      <ListTodo size={40} color="#475569" />
      <p style={{ fontSize: 14, color: "#475569", textAlign: "center", fontWeight: 700 }}>Tasks coming soon</p>
      <p style={{ fontSize: 12, color: "#334155", textAlign: "center", margin: 0 }}>We&apos;ll build this together.</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const [tab, setTab] = useState<TabId>("overview");
  const [agents, setAgents] = useState<AgentDef[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [routineCount, setRoutineCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, metricsRes, routinesRes] = await Promise.allSettled([
        fetch(`${BOT_URL}/admin/agents`).then(r => r.json()),
        fetch(`${BOT_URL}/admin/agent-metrics`).then(r => r.json()).catch(() => null),
        fetch(`${BOT_URL}/admin/routines`).then(r => r.json()).catch(() => []),
      ]);

      if (agentsRes.status === "fulfilled") {
        const d = agentsRes.value;
        setAgents(Array.isArray(d) ? d : (d.agents ?? []));
      }
      if (metricsRes.status === "fulfilled" && metricsRes.value) {
        const m = metricsRes.value;
        const totalRuns = Array.isArray(m.agents) ? m.agents.reduce((s: number, a: any) => s + (a.runs30d ?? 0), 0) : 0;
        const totalCost = Array.isArray(m.agents) ? m.agents.reduce((s: number, a: any) => s + (a.costUsd ?? 0), 0) : 0;
        setMetrics({ ...m, totalRuns, totalCost });
      }
      if (routinesRes.status === "fulfilled") {
        setRoutineCount(Array.isArray(routinesRes.value) ? routinesRes.value.length : 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const metricsWithRoutines = { ...(metrics ?? {}), routines: routineCount };

  return (
    <div className="px-4 pb-6 pt-4">
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0 }}>Agents</h1>
          <p style={{ fontSize: 11, color: "#475569", margin: "2px 0 0" }}>
            {loading ? "Loading…" : `${agents.length} agents deployed`}
          </p>
        </div>
        <button onClick={() => { setLoading(true); fetchData(); }} style={{
          display: "flex", alignItems: "center", gap: 5,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8, color: "#64748b", cursor: "pointer", padding: "5px 10px", fontSize: 11,
        }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <TabBar active={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {tab === "overview" && <OverviewTab agents={agents} metrics={metricsWithRoutines} />}
          {tab === "leads"    && <LeadsTab agents={agents} allAgents={agents} />}
          {tab === "agents"   && <AgentCRUD hideLeads />}
          {tab === "tasks"    && <TasksTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
