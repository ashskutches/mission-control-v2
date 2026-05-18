"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp,
  ExternalLink, Copy, Check, Loader2, FileText, Zap, Layout,
  Globe, Target, Users, Edit3, Save, X, ArrowRight,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LandingPage {
  id: string;
  title: string;
  status: "draft" | "brief_ready" | "generating" | "done";
  reference_url: string | null;
  angle: string | null;
  target_audience: string | null;
  notes: string | null;
  brief: any;
  job_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentDef {
  id: string;
  name: string;
  emoji?: string;
  specialization?: string;
}

interface BriefSection {
  position: number;
  name: string;
  liquid_section: string;
  conversion_principle: string;
  headline: string;
  body: string;
  cta_text: string | null;
  asset_type: string;
  asset_slot: string;
  suggested_asset_id: string | null;
  notes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:        { label: "Draft",        color: "#475569", bg: "rgba(71,85,105,0.15)" },
  brief_ready:  { label: "Brief Ready",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  generating:   { label: "Generating…",  color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  done:         { label: "Done",         color: "#34d399", bg: "rgba(52,211,153,0.12)" },
} as const;

function StatusBadge({ status }: { status: LandingPage["status"] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}30`, borderRadius: 5, padding: "2px 7px",
      textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {cfg.label}
    </span>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  return (
    <button onClick={copy} style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#34d399" : "#475569", padding: 4 }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

// ── New LP Form ───────────────────────────────────────────────────────────────
function NewLPForm({ onCreated }: { onCreated: (lp: LandingPage) => void }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [angle, setAngle] = useState("");
  const [audience, setAudience] = useState("Women 45–65 with joint pain");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!title.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/landing-pages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), reference_url: url.trim() || null,
          angle: angle.trim() || null, target_audience: audience.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const lp = await res.json();
      setTitle(""); setUrl(""); setAngle(""); 
      onCreated(lp);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background: "rgba(129,140,248,0.05)", border: "1px solid rgba(129,140,248,0.15)",
      borderRadius: 14, padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(129,140,248,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Plus size={14} color="#818cf8" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>New Landing Page</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        {[
          { label: "Page Title *", value: title, set: setTitle, placeholder: "Lymphatic Drainage Angle" },
          { label: "Reference URL", value: url, set: setUrl, placeholder: "https://example.com/landing" },
          { label: "Angle / Topic", value: angle, set: setAngle, placeholder: "Lymph health + rebounding" },
          { label: "Target Audience", value: audience, set: setAudience, placeholder: "Women 45-65 with joint pain" },
        ].map(f => (
          <div key={f.label}>
            <label style={{ fontSize: 10, color: "#475569", fontWeight: 700, display: "block", marginBottom: 4,
              textTransform: "uppercase", letterSpacing: "0.07em" }}>{f.label}</label>
            <input value={f.value} onChange={e => f.set(e.target.value)}
              placeholder={f.placeholder}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 8, padding: "7px 10px", color: "#e2e8f0", fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box" }} />
          </div>
        ))}
      </div>

      {error && <p style={{ fontSize: 11, color: "#ef4444", margin: "0 0 8px" }}>{error}</p>}

      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={create}
        disabled={loading || !title.trim()}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9,
          background: loading || !title.trim() ? "rgba(129,140,248,0.1)" : "rgba(129,140,248,0.2)",
          border: "1px solid rgba(129,140,248,0.3)", color: "#818cf8", fontSize: 12, fontWeight: 700,
          cursor: loading || !title.trim() ? "not-allowed" : "pointer" }}>
        {loading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={13} />}
        Create
      </motion.button>
    </div>
  );
}

// ── LP Card ───────────────────────────────────────────────────────────────────
function LPCard({ lp, agents, onRefresh }: { lp: LandingPage; agents: AgentDef[]; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [brief, setBrief] = useState<any>(lp.brief ?? {});
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [sections, setSections] = useState<BriefSection[]>(lp.brief?.sections ?? []);
  const [jobOutput, setJobOutput] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const pollRef = useRef<any>(null);

  // Poll job status while generating
  useEffect(() => {
    if (lp.status === "generating" && lp.job_id) {
      const poll = async () => {
        try {
          const res = await fetch(`${BOT_URL}/admin/jobs/${lp.job_id}`);
          if (!res.ok) return;
          const job = await res.json();
          if (job.agent_output) setJobOutput(job.agent_output);
          if (job.status === "done" || job.status === "failed") { onRefresh(); clearInterval(pollRef.current); }
        } catch { /* silent */ }
      };
      pollRef.current = setInterval(poll, 5000);
      return () => clearInterval(pollRef.current);
    }
  }, [lp.status, lp.job_id, onRefresh]);

  const generateBrief = async () => {
    setBriefLoading(true); setErr(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/landing-pages/${lp.id}/generate-brief`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setBrief(data.brief);
      setSections(data.brief?.sections ?? []);
      onRefresh();
    } catch (e: any) { setErr(e.message); }
    finally { setBriefLoading(false); }
  };

  const saveBrief = async () => {
    try {
      const updatedBrief = { ...brief, sections };
      await fetch(`${BOT_URL}/admin/landing-pages/${lp.id}/brief`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: updatedBrief }),
      });
      onRefresh();
    } catch { /* silent */ }
  };

  const generateCode = async () => {
    if (!agentId) return;
    setGenLoading(true); setErr(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/landing-pages/${lp.id}/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, agent_name: agents.find(a => a.id === agentId)?.name }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onRefresh();
    } catch (e: any) { setErr(e.message); }
    finally { setGenLoading(false); }
  };

  const deleteLp = async () => {
    if (!confirm(`Delete "${lp.title}"?`)) return;
    await fetch(`${BOT_URL}/admin/landing-pages/${lp.id}`, { method: "DELETE" });
    onRefresh();
  };

  const updateSection = (idx: number, field: keyof BriefSection, val: string) => {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  const hasBrief = sections.length > 0;

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>

      {/* Header */}
      <div onClick={() => setExpanded(v => !v)} style={{ padding: "13px 16px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(129,140,248,0.12)",
          border: "1px solid rgba(129,140,248,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Layout size={14} color="#818cf8" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{lp.title}</span>
            <StatusBadge status={lp.status} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
            {lp.angle && <span style={{ fontSize: 11, color: "#818cf8" }}>{lp.angle}</span>}
            {lp.reference_url && (
              <a href={lp.reference_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                style={{ fontSize: 10, color: "#475569", display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}>
                <ExternalLink size={9} /> ref
              </a>
            )}
            {hasBrief && <span style={{ fontSize: 10, color: "#334155" }}>{sections.length} sections</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); deleteLp(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#334155", padding: 4 }}>
            <Trash2 size={12} />
          </button>
          {expanded ? <ChevronUp size={13} color="#475569" /> : <ChevronDown size={13} color="#475569" />}
        </div>
      </div>

      {/* Expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: "0 16px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>

              {/* Action Bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={generateBrief}
                  disabled={briefLoading}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8,
                    background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b",
                    fontSize: 12, fontWeight: 700, cursor: briefLoading ? "not-allowed" : "pointer" }}>
                  {briefLoading ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={12} />}
                  {hasBrief ? "Re-generate Brief" : "Generate Brief"}
                </motion.button>

                {hasBrief && (
                  <>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={saveBrief}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8,
                        background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399",
                        fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      <Save size={12} /> Save Brief
                    </motion.button>

                    <select value={agentId} onChange={e => setAgentId(e.target.value)}
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8, color: "#94a3b8", padding: "6px 10px", fontSize: 11, fontFamily: "inherit", outline: "none" }}>
                      {agents.map(a => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
                    </select>

                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={generateCode}
                      disabled={genLoading || lp.status === "generating"}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8,
                        background: genLoading || lp.status === "generating" ? "rgba(129,140,248,0.08)" : "rgba(129,140,248,0.18)",
                        border: "1px solid rgba(129,140,248,0.3)", color: "#818cf8",
                        fontSize: 12, fontWeight: 700, cursor: genLoading || lp.status === "generating" ? "not-allowed" : "pointer" }}>
                      {genLoading || lp.status === "generating" ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={12} />}
                      Generate Code
                    </motion.button>
                  </>
                )}
              </div>

              {err && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 8 }}>{err}</p>}

              {/* Brief Sections */}
              {hasBrief && (
                <div style={{ marginTop: 16 }}>
                  {brief.conversion_angle && (
                    <p style={{ fontSize: 11, color: "#818cf8", fontStyle: "italic", margin: "0 0 12px" }}>
                      💡 {brief.conversion_angle}
                    </p>
                  )}
                  {sections.map((s, i) => (
                    <div key={i} style={{ marginBottom: 8, background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#475569", background: "rgba(255,255,255,0.06)",
                          borderRadius: 4, padding: "1px 6px" }}>§{s.position}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>{s.name}</span>
                        <span style={{ fontSize: 10, color: "#334155", fontFamily: "monospace" }}>{s.liquid_section}</span>
                        <button onClick={() => setEditingSection(editingSection === i ? null : i)}
                          style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#475569" }}>
                          {editingSection === i ? <X size={12} /> : <Edit3 size={12} />}
                        </button>
                      </div>

                      {editingSection === i ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          {([
                            ["Headline", "headline"], ["Body", "body"], ["CTA Text", "cta_text"],
                            ["Conversion Principle", "conversion_principle"], ["Notes", "notes"],
                          ] as [string, keyof BriefSection][]).map(([label, field]) => (
                            <div key={field}>
                              <label style={{ fontSize: 9, color: "#475569", fontWeight: 700, display: "block", marginBottom: 2,
                                textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</label>
                              <textarea value={(s[field] ?? "") as string}
                                onChange={e => updateSection(i, field, e.target.value)}
                                rows={field === "body" || field === "conversion_principle" ? 3 : 1}
                                style={{ width: "100%", background: "rgba(255,255,255,0.03)",
                                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "5px 8px",
                                  color: "#e2e8f0", fontSize: 11, fontFamily: "inherit", resize: "vertical",
                                  outline: "none", boxSizing: "border-box" }} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div>
                          {s.headline && <p style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", margin: "0 0 4px" }}>"{s.headline}"</p>}
                          {s.body && <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 4px", lineHeight: 1.5 }}>{s.body}</p>}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                            {s.cta_text && (
                              <span style={{ fontSize: 10, color: "#f59e0b", background: "rgba(245,158,11,0.08)",
                                border: "1px solid rgba(245,158,11,0.2)", borderRadius: 4, padding: "1px 7px" }}>
                                CTA: {s.cta_text}
                              </span>
                            )}
                            {s.asset_type && s.asset_type !== "none" && (
                              <span style={{ fontSize: 10, color: "#475569", background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "1px 7px" }}>
                                {s.asset_type}: {s.asset_slot}
                              </span>
                            )}
                          </div>
                          {s.conversion_principle && (
                            <p style={{ fontSize: 10, color: "#334155", marginTop: 4, fontStyle: "italic" }}>
                              → {s.conversion_principle}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Code output */}
              {(lp.status === "done" || lp.status === "generating") && (lp.job_id || jobOutput) && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <FileText size={12} color="#818cf8" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {lp.status === "generating" ? "Generating…" : "Code Output"}
                    </span>
                    {jobOutput && <CopyBtn text={jobOutput} />}
                    {lp.job_id && (
                      <span style={{ marginLeft: "auto", fontSize: 10, color: "#334155" }}>
                        Job: {lp.job_id?.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  {lp.status === "generating" && !jobOutput && (
                    <div style={{ display: "flex", gap: 4, padding: "10px 0" }}>
                      {[0,1,2].map(i => (
                        <motion.span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#818cf8", display: "block" }}
                          animate={{ scale: [1,1.5,1], opacity: [0.3,1,0.3] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                      ))}
                    </div>
                  )}
                  {jobOutput && (
                    <div style={{ background: "#070712", borderRadius: 10, padding: "10px 12px",
                      border: "1px solid rgba(255,255,255,0.06)", maxHeight: 400, overflowY: "auto" }}>
                      <pre style={{ fontSize: 11, color: "#94a3b8", margin: 0, whiteSpace: "pre-wrap",
                        wordBreak: "break-word", lineHeight: 1.65, fontFamily: "monospace" }}>
                        {jobOutput}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function LandingPageFactory({ agents }: { agents: AgentDef[] }) {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPages = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/landing-pages`);
      if (!res.ok) return;
      const data = await res.json();
      setPages(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {(["draft","brief_ready","generating","done"] as const).map(s => {
          const count = pages.filter(p => p.status === s).length;
          const cfg = STATUS_CONFIG[s];
          return (
            <div key={s} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12,
              background: cfg.bg, border: `1px solid ${cfg.color}25`, color: cfg.color,
              display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontWeight: 800 }}>{count}</span>
              <span style={{ fontWeight: 400, opacity: 0.7 }}>{cfg.label}</span>
            </div>
          );
        })}
        <button onClick={fetchPages} style={{ marginLeft: "auto", display: "flex", alignItems: "center",
          gap: 5, fontSize: 11, padding: "4px 10px", borderRadius: 7, cursor: "pointer",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#475569" }}>
          <RefreshCw size={10} /> Refresh
        </button>
      </div>

      <NewLPForm onCreated={lp => setPages(prev => [lp, ...prev])} />

      <div style={{ marginTop: "1.5rem" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#334155", fontSize: 13, padding: "1rem 0" }}>
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading…
          </div>
        ) : pages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#334155", fontSize: 13,
            background: "rgba(255,255,255,0.015)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
            No landing pages yet — create one above ↑
          </div>
        ) : (
          <AnimatePresence>
            {pages.map(lp => <LPCard key={lp.id} lp={lp} agents={agents} onRefresh={fetchPages} />)}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
