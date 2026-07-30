"use client";

/**
 * /quick-run — one-off agent actions.
 *
 * The third of the three ways work reaches an agent, and the only one that is a
 * console rather than a queue:
 *
 *   /pipeline   insights → approve → assign to an agent or a human (strategic intake)
 *   /research   ask a question → staged investigation → a cited report
 *   /quick-run  describe an action → one agent → one pass → done
 *   /work       the tracked queue of assigned work with milestones and blockages
 *
 * This used to be a tab on the Agents page called "Tasks", sitting next to a
 * left-nav item also called "Tasks" that meant something else entirely. Same name,
 * different table, different lifecycle. Splitting research off to its own surface
 * left this as what it always actually was: a dispatch console.
 *
 * The run log lives in JobsTab, which owns the composer, polling and history.
 */

import React from "react";
import { Zap } from "lucide-react";
import JobsTab from "@/components/JobsTab";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

interface AgentDef {
  id: string; name: string; emoji?: string;
  specialization?: string; mission?: string; category?: string;
}

export default function QuickRunPage() {
  const [agents, setAgents] = React.useState<AgentDef[]>([]);

  React.useEffect(() => {
    fetch(`${BOT_URL}/admin/agents`)
      .then(r => (r.ok ? r.json() : []))
      .then(a => setAgents(Array.isArray(a) ? a : []))
      .catch(() => {});
  }, []);

  return (
    <div style={{ padding: "22px 26px", maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 6 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, background: "rgba(74,158,255,0.1)",
          border: "1px solid rgba(74,158,255,0.25)", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <Zap size={15} color="#4a9eff" />
        </div>
        <h1 style={{ fontSize: 19, fontWeight: 800, color: "#e2e8f0", margin: 0 }}>Quick Run</h1>
      </div>
      <p style={{ fontSize: 11.5, color: "#64748b", margin: "0 0 18px" }}>
        One action, once — an agent does it and reports back. To investigate something
        and get a cited report, use{" "}
        <a href="/research" style={{ color: "#a78bfa", textDecoration: "none" }}>Research</a>.
        For tracked work with milestones, see{" "}
        <a href="/work" style={{ color: "#4a9eff", textDecoration: "none" }}>Tasks</a>.
      </p>

      <JobsTab agents={agents} />
    </div>
  );
}
