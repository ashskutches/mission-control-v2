"use client";
import React, { useState, useEffect } from "react";
import { NeuralExplorer } from "@/components/NeuralExplorer";
import { ProviderMatrix } from "@/components/ProviderMatrix";
import { StatCard } from "@/components/StatCard";
import { Zap, Database, Clock, Activity } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

export default function EnginePage() {
  const [facts, setFacts] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("bot_facts").select("*").order("updated_at", { ascending: false });
      if (data) setFacts(data);
      try {
        const r = await fetch(`${BOT_URL}/health`, { signal: AbortSignal.timeout(5000) });
        const h = await r.json();
        setHealth(h);
      } catch { /* offline */ }
    })();
  }, []);

  return (
    <div className="px-4 pb-6 pt-4" style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      <div>
        <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Knowledge Synapse</h3>
        <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold mb-5" style={{ letterSpacing: "0.08em" }}>Memory nodes & intelligence fragments</p>
        <NeuralExplorer facts={facts} />
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

      <div className="columns is-multiline">
        <div className="column is-6">
          <div className="mb-4">
            <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Orchestration Health</h3>
            <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold" style={{ letterSpacing: "0.08em" }}>Compute Allocation</p>
          </div>
          <div className="box p-8">
            <ProviderMatrix stats={[
              { name: "Anthropic Claude 3.7", share: 85, health: "online", color: "var(--accent-orange)" },
              { name: "OpenAI GPT-4o", share: 10, health: "online", color: "var(--accent-blue)" },
              { name: "Local Llama 3 (Fallback)", share: 5, health: "slow", color: "var(--accent-purple)" },
            ]} />
          </div>
        </div>
        <div className="column is-6">
          <div className="mb-4">
            <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Unit Vitals</h3>
            <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold" style={{ letterSpacing: "0.08em" }}>Runtime Health</p>
          </div>
          <div className="columns is-multiline">
            <div className="column is-6"><StatCard label="Memory RSS" value={health ? `${Math.round(health.memory.rss / 1024 / 1024)}mb` : "---"} color="var(--accent-cyan)" icon={Zap} /></div>
            <div className="column is-6"><StatCard label="Heap Used" value={health ? `${Math.round(health.memory.heapUsed / 1024 / 1024)}mb` : "---"} color="var(--accent-purple)" icon={Database} /></div>
            <div className="column is-6"><StatCard label="Uptime" value={health ? `${Math.round(health.uptime / 60)}m` : "---"} color="var(--accent-emerald)" icon={Clock} /></div>
            <div className="column is-6"><StatCard label="Latency" value="42ms" color="var(--accent-orange)" icon={Activity} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
