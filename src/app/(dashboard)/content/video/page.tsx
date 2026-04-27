"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video, Sparkles, Send, Clock, CheckCircle2, AlertCircle,
  RefreshCw, ChevronDown, ChevronUp, Play, Eye,
  Film, Cpu, Layers, ArrowLeft,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const ACCENT = "#f59e0b";

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "1.25rem",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface VideoJob {
  id: string;
  status: "draft" | "pending" | "rendering" | "done" | "failed";
  created_at: string;
  updated_at: string;
  output_url?: string;
  error_message?: string;
  retry_count?: number;
  storyboard?: Record<string, unknown>;
}

interface PlanResult {
  job_id: string;
  storyboard: Record<string, unknown>;
  clips_evaluated: number;
  clips_selected: number;
  ollama_model: string;
  attempts: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  draft: "#64748b", pending: "#f59e0b", rendering: "#38bdf8", done: "#10b981", failed: "#f43f5e",
};
const STATUS_ICON: Record<string, React.ElementType> = {
  draft: Clock, pending: CheckCircle2, rendering: RefreshCw, done: Play, failed: AlertCircle,
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? "#64748b";
  const Icon = STATUS_ICON[status] ?? Clock;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em",
      color, background: `${color}15`, border: `1px solid ${color}30`,
      borderRadius: 10, padding: "2px 7px",
    }}>
      <Icon size={9} />
      {status}
    </span>
  );
}

// ── Storyboard Viewer ─────────────────────────────────────────────────────────

function StoryboardViewer({ storyboard, clipsEvaluated, clipsSelected, model, attempts }: {
  storyboard: Record<string, unknown>;
  clipsEvaluated?: number;
  clipsSelected?: number;
  model?: string;
  attempts?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const beats = Array.isArray((storyboard as any).beats) ? (storyboard as any).beats : [];

  return (
    <div style={{ marginTop: "1rem" }}>
      {/* Meta badges */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        {[
          { label: "Clips evaluated", value: clipsEvaluated, color: "#38bdf8" },
          { label: "Clips selected", value: clipsSelected, color: ACCENT },
          { label: "Model", value: model, color: "#a78bfa" },
          { label: "LLM attempts", value: attempts, color: "#10b981" },
        ].filter(b => b.value !== undefined).map(b => (
          <span key={b.label} style={{ fontSize: 10, color: b.color, background: `${b.color}12`, border: `1px solid ${b.color}25`, borderRadius: 8, padding: "2px 8px", fontWeight: 700 }}>
            {b.label}: {String(b.value)}
          </span>
        ))}
      </div>

      {/* Title */}
      {(storyboard as any).title && (
        <p style={{ fontWeight: 800, color: "#f1f5f9", fontSize: 16, marginBottom: "0.25rem" }}>{(storyboard as any).title}</p>
      )}
      {(storyboard as any).description && (
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: "0.75rem" }}>{(storyboard as any).description}</p>
      )}

      {/* Beats */}
      {beats.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ fontSize: 11, color: ACCENT, fontWeight: 700, cursor: "pointer", background: "none", border: "none", padding: 0, display: "flex", alignItems: "center", gap: 4, marginBottom: "0.5rem" }}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {beats.length} Beats {expanded ? "Hide" : "Preview"}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                style={{ overflow: "hidden" }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 280, overflowY: "auto" }}>
                  {beats.map((beat: any, i: number) => (
                    <div key={i} style={{ padding: "0.5rem 0.75rem", background: "rgba(255,255,255,0.02)", borderRadius: 8, borderLeft: `2px solid ${ACCENT}40` }}>
                      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 9, fontWeight: 900, color: ACCENT, minWidth: 20 }}>#{i + 1}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                          {beat.in_point_s ?? beat.in_point}s → {beat.out_point_s ?? beat.out_point}s
                        </span>
                        {beat.source_file && (
                          <span style={{ fontSize: 9, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                            {String(beat.source_file).split("/").pop()}
                          </span>
                        )}
                      </div>
                      {beat.caption && <p style={{ fontSize: 11, color: "#64748b", marginLeft: 28 }}>{beat.caption}</p>}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Raw JSON fallback */}
      {beats.length === 0 && (
        <pre style={{ fontSize: 10, color: "#64748b", background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "0.75rem", overflowX: "auto", maxHeight: 200 }}>
          {JSON.stringify(storyboard, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Planner Panel ─────────────────────────────────────────────────────────────

function PlannerPanel({ onJobCreated }: { onJobCreated: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const QUICK_PROMPTS = [
    "Create a 60-second brand awareness reel showcasing the rebounder's health benefits",
    "Make a high-energy workout montage for Instagram Reels (30 seconds)",
    "Product demo video highlighting joint impact reduction for ads",
    "Testimonial-style edit using real customer clips for email campaigns",
  ];

  const handlePlan = async () => {
    if (!prompt.trim()) return;
    setState("loading");
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`${BOT_URL}/admin/video/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      setResult({
        job_id: json.data.job_id,
        storyboard: json.data.storyboard,
        clips_evaluated: json.data.clips_evaluated,
        clips_selected: json.data.clips_selected,
        ollama_model: json.data.ollama_model,
        attempts: json.data.attempts,
      });
      setState("success");
      onJobCreated();
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
      setState("error");
    }
  };

  return (
    <div style={CARD}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${ACCENT}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={16} color={ACCENT} />
        </div>
        <div>
          <p style={{ fontWeight: 800, color: "#f1f5f9", fontSize: 14, margin: 0 }}>Video Planner Agent</p>
          <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Describe the video → AI selects clips + builds storyboard</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Cpu size={11} color="#a78bfa" />
          <span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700 }}>hermes3:8b</span>
        </div>
      </div>

      {/* Quick prompts */}
      <p style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.5rem" }}>Quick briefs</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
        {QUICK_PROMPTS.map(p => (
          <button key={p} onClick={() => setPrompt(p)}
            style={{ fontSize: 10, color: ACCENT, background: `${ACCENT}0d`, border: `1px solid ${ACCENT}22`, borderRadius: 20, padding: "0.2rem 0.65rem", cursor: "pointer", transition: "all 0.12s" }}
            onMouseEnter={e => (e.currentTarget.style.background = `${ACCENT}18`)}
            onMouseLeave={e => (e.currentTarget.style.background = `${ACCENT}0d`)}
          >
            {p.length > 55 ? p.slice(0, 55) + "…" : p}
          </button>
        ))}
      </div>

      {/* Prompt textarea */}
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Describe the video you want to create — audience, tone, length, key messages…"
        rows={4}
        style={{
          width: "100%", resize: "vertical", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, padding: "0.75rem", color: "#e2e8f0", fontSize: 13, fontFamily: "inherit",
          outline: "none", boxSizing: "border-box",
        }}
        onFocus={e => (e.currentTarget.style.borderColor = `${ACCENT}50`)}
        onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
      />

      {/* Submit */}
      <button
        onClick={handlePlan}
        disabled={state === "loading" || !prompt.trim()}
        style={{
          marginTop: "0.75rem",
          display: "flex", alignItems: "center", gap: "0.5rem",
          background: state === "loading" ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${ACCENT}, #d97706)`,
          border: "none", borderRadius: 10, padding: "0.65rem 1.25rem",
          color: state === "loading" ? "#64748b" : "#0f172a", fontWeight: 800, fontSize: 13, cursor: state === "loading" ? "not-allowed" : "pointer",
          transition: "all 0.15s",
        }}
      >
        {state === "loading" ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
        {state === "loading" ? "Planning… (this takes 30-90s)" : "Generate Storyboard"}
      </button>

      {/* Results */}
      <AnimatePresence mode="wait">
        {state === "success" && result && (
          <motion.div key="success" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <CheckCircle2 size={14} color="#10b981" />
              <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>Draft storyboard created</span>
              <code style={{ fontSize: 10, color: "#475569", marginLeft: "auto" }}>#{result.job_id.slice(0, 8)}</code>
            </div>
            <StoryboardViewer
              storyboard={result.storyboard}
              clipsEvaluated={result.clips_evaluated}
              clipsSelected={result.clips_selected}
              model={result.ollama_model}
              attempts={result.attempts}
            />
          </motion.div>
        )}

        {state === "error" && error && (
          <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: "1rem", padding: "0.75rem", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <AlertCircle size={13} color="#f43f5e" />
              <span style={{ fontSize: 12, color: "#f43f5e", fontWeight: 700 }}>Planner failed</span>
            </div>
            <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", wordBreak: "break-word" }}>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Job List Panel ─────────────────────────────────────────────────────────────

function JobListPanel({ jobs, loading, onRefresh }: { jobs: VideoJob[]; loading: boolean; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div style={CARD}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <Film size={14} color="#38bdf8" />
        <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, flex: 1, margin: 0 }}>
          Video Jobs
        </p>
        <button onClick={onRefresh} className="button is-ghost is-small" style={{ color: "#475569", padding: 4 }} aria-label="Refresh jobs">
          <RefreshCw size={12} className={loading ? "spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[0, 1, 2].map(i => <div key={i} style={{ height: 52, background: "rgba(255,255,255,0.03)", borderRadius: 8, animation: "pulse 1.5s infinite" }} />)}
        </div>
      ) : jobs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem 0" }}>
          <Film size={28} color="#334155" style={{ marginBottom: "0.5rem" }} />
          <p style={{ fontSize: 12, color: "#475569" }}>No jobs yet — generate your first storyboard above.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {jobs.map((job, i) => {
            const isExpanded = expanded === job.id;
            return (
              <motion.div key={job.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : job.id)}
                  style={{ width: "100%", textAlign: "left", background: isExpanded ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${isExpanded ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)"}`, borderRadius: 8, padding: "0.6rem 0.75rem", cursor: "pointer", transition: "all 0.12s" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[job.status] ?? "#64748b", flexShrink: 0 }} />
                    <code style={{ fontSize: 11, color: "#94a3b8", flex: 1 }}>#{job.id.slice(0, 8)}</code>
                    <StatusBadge status={job.status} />
                    <span style={{ fontSize: 10, color: "#475569" }}>{new Date(job.created_at).toLocaleDateString()}</span>
                    {isExpanded ? <ChevronUp size={11} color="#475569" /> : <ChevronDown size={11} color="#475569" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div key="detail" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                      <div style={{ padding: "0.75rem", background: "rgba(255,255,255,0.01)", borderLeft: `2px solid ${STATUS_COLOR[job.status] ?? "#64748b"}40`, marginLeft: 4, marginTop: 2, borderRadius: "0 0 8px 8px" }}>
                        {job.output_url && (
                          <a href={job.output_url} target="_blank" rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#10b981", fontWeight: 700, textDecoration: "none", marginBottom: "0.5rem" }}>
                            <Eye size={11} /> View output →
                          </a>
                        )}
                        {job.error_message && (
                          <p style={{ fontSize: 11, color: "#f43f5e", fontFamily: "monospace", wordBreak: "break-word" }}>{job.error_message}</p>
                        )}
                        {job.storyboard && (
                          <StoryboardViewer storyboard={job.storyboard} />
                        )}
                        {!job.storyboard && !job.output_url && !job.error_message && (
                          <p style={{ fontSize: 11, color: "#475569" }}>No additional details available.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function VideoAgentPage() {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/video/jobs?limit=20`);
      if (res.ok) {
        const d = await res.json();
        setJobs(d.data ?? []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  return (
    <div>

      {/* Pipeline info banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ ...CARD, marginBottom: "1.5rem", background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.12)" }}>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          {[
            { step: "1", label: "Plan", desc: "AI selects clips + builds storyboard", icon: Sparkles, color: ACCENT },
            { step: "2", label: "Review", desc: "Inspect beats, edit if needed", icon: Eye, color: "#38bdf8" },
            { step: "3", label: "Approve", desc: "Sets status → pending for the worker", icon: CheckCircle2, color: "#10b981" },
            { step: "4", label: "Render", desc: "Windows worker picks up + renders", icon: Cpu, color: "#a78bfa" },
          ].map(({ step, label, desc, icon: Icon, color }) => (
            <div key={step} style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1, minWidth: 160 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={12} color={color} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 800, color: "#e2e8f0", margin: 0 }}>{step}. {label}</p>
                <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Main layout: planner left, jobs right */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>
        <PlannerPanel onJobCreated={fetchJobs} />
        <JobListPanel jobs={jobs} loading={loading} onRefresh={fetchJobs} />
      </div>
    </div>
  );
}
