"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Search, X, Clock, Zap, ExternalLink,
  ChevronRight, BookOpen, Filter, RefreshCw, Bot,
} from "lucide-react";
import Link from "next/link";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

interface LibraryDoc {
  id: string;
  agent_id: string;
  routine_id: string | null;
  routine_name: string | null;
  content: string;
  excerpt: string;
  tools_used: string[] | null;
  provider: string | null;
  triggered_by: "cron" | "manual" | null;
  created_at: string;
  duration_ms: number | null;
}

interface Agent { id: string; name: string; emoji?: string; specialization?: string; }

// ── Helpers ────────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function wordCount(text: string) { return text.trim().split(/\s+/).length.toLocaleString(); }

// ── Document Viewer Modal ──────────────────────────────────────────────────────
function DocViewer({ doc, agent, onClose }: { doc: LibraryDoc; agent: Agent | undefined; onClose: () => void }) {
  const agentColor = "#ff8c00";
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.93, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 820, maxHeight: "90vh", background: "rgba(10,10,14,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,0.9)" }}
      >
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,140,0,0.1)", border: "1px solid rgba(255,140,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>
            {agent?.emoji ?? "🤖"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "#fff", fontWeight: 800, fontSize: 15, margin: 0, marginBottom: 4 }}>
              {doc.routine_name ?? "Agent Output"}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {agent && (
                <Link href={`/agents/${doc.agent_id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: agentColor, textDecoration: "none", fontWeight: 700 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")} onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                  <Bot size={10} /> {agent.name} <ExternalLink size={9} />
                </Link>
              )}
              <span style={{ fontSize: 10, color: "#555" }}>{fmtDate(doc.created_at)}</span>
              <span style={{ fontSize: 10, color: "#555" }}>{wordCount(doc.content)} words</span>
              {doc.duration_ms && <span style={{ fontSize: 10, color: "#555" }}>⏱ {(doc.duration_ms / 1000).toFixed(1)}s</span>}
              {doc.triggered_by === "manual" && (
                <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)", fontWeight: 700 }}>⚡ Manual</span>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#888", cursor: "pointer", padding: "6px 8px", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>

        {/* Tools row */}
        {doc.tools_used && doc.tools_used.length > 0 && (
          <div style={{ padding: "0.625rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#555", marginRight: 2 }}><Zap size={9} style={{ display: "inline", marginRight: 3 }} />Tools:</span>
            {doc.tools_used.map(t => (
              <span key={t} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)", color: "#a78bfa" }}>
                {t.replace("shopify__", "")}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }} className="custom-scrollbar">
          <pre style={{ color: "#e8e8e8", fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", margin: 0, background: "rgba(0,0,0,0.45)", borderRadius: 10, padding: "1.25rem", border: "1px solid rgba(255,255,255,0.06)" }}>
            {doc.content}
          </pre>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DocumentLibrary() {
  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [selected, setSelected] = useState<LibraryDoc | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const LIMIT = 40;

  const fetchDocs = useCallback(async (reset = false) => {
    const offset = reset ? 0 : offsetRef.current;
    if (reset) { setLoading(true); offsetRef.current = 0; }
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (filterAgent !== "all") params.set("agent_id", filterAgent);
      if (search.trim()) params.set("search", search.trim());
      const r = await fetch(`${BOT_URL}/admin/library?${params}`);
      const data = await r.json();
      const incoming: LibraryDoc[] = data.documents ?? [];
      if (reset) {
        setDocs(incoming);
      } else {
        setDocs(prev => [...prev, ...incoming]);
      }
      offsetRef.current = offset + incoming.length;
      setHasMore(incoming.length === LIMIT);
    } catch { /* silent */ } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filterAgent, search]);

  useEffect(() => {
    fetch(`${BOT_URL}/admin/agents`).then(r => r.json()).then(d => setAgents(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => { fetchDocs(true); }, [fetchDocs]);

  const agentFor = (id: string) => agents.find(a => a.id === id);

  const palette = ["#22c55e", "#38bdf8", "#a855f7", "#ff8c00", "#f43f5e", "#06b6d4", "#f59e0b"];
  const agentColor = (id: string) => { const idx = agents.findIndex(a => a.id === id); return palette[idx % palette.length] ?? "#22c55e"; };

  // Unique agents that appear in results for filter dropdown
  const presentAgentIds = [...new Set(docs.map(d => d.agent_id))];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%" }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#555", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") fetchDocs(true); }}
            placeholder="Search document content…"
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#fff", fontSize: 13, padding: "8px 12px 8px 32px", outline: "none", boxSizing: "border-box" }}
          />
          {search && (
            <button onClick={() => { setSearch(""); fetchDocs(true); }} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#555", padding: 2, display: "flex" }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Agent filter */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
          <Filter size={12} style={{ color: "#555" }} />
          <select
            value={filterAgent}
            onChange={e => setFilterAgent(e.target.value)}
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#aaa", fontSize: 12, padding: "7px 10px", cursor: "pointer", outline: "none" }}
          >
            <option value="all">All Agents</option>
            {presentAgentIds.map(id => {
              const a = agentFor(id);
              return <option key={id} value={id}>{a?.emoji ?? "🤖"} {a?.name ?? id}</option>;
            })}
          </select>
        </div>

        <button onClick={() => fetchDocs(true)} title="Refresh" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#666", cursor: "pointer", padding: "7px 9px", display: "flex", alignItems: "center" }}>
          <RefreshCw size={13} />
        </button>

        <span style={{ fontSize: 11, color: "#555" }}>{docs.length} document{docs.length !== 1 ? "s" : ""}</span>
      </div>

      {/* ── Loading / Empty ─────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, opacity: 0.4 }}>
          <BookOpen size={40} />
          <p style={{ color: "#ccc", fontSize: 14 }}>Loading library…</p>
        </div>
      )}

      {!loading && docs.length === 0 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.35, gap: 10 }}>
          <FileText size={48} />
          <p style={{ color: "#ccc", fontWeight: 700, fontSize: 14, margin: 0 }}>No documents yet</p>
          <p style={{ color: "#555", fontSize: 12, margin: 0 }}>Agent outputs from routine runs will appear here</p>
        </div>
      )}

      {/* ── Document Grid ───────────────────────────────────────────────────── */}
      {!loading && docs.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, overflowY: "auto" }} className="custom-scrollbar">
          <AnimatePresence initial={false}>
            {docs.map((doc, i) => {
              const agent = agentFor(doc.agent_id);
              const color = agentColor(doc.agent_id);
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i < 12 ? i * 0.03 : 0 }}
                  onClick={() => setSelected(doc)}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 14,
                    padding: "1rem",
                    cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${color}40`; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.035)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
                >
                  {/* Card header */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}14`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>
                      {agent?.emoji ?? "🤖"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "#fff", fontWeight: 700, fontSize: 13, margin: 0, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.routine_name ?? "Agent Output"}
                      </p>
                      <Link
                        href={`/agents/${doc.agent_id}`}
                        onClick={e => e.stopPropagation()}
                        style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, color, textDecoration: "none", fontWeight: 700, marginTop: 2, opacity: 0.85 }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = "1")} onMouseLeave={e => (e.currentTarget.style.opacity = "0.85")}
                      >
                        <Bot size={9} /> {agent?.name ?? doc.agent_id} <ExternalLink size={8} />
                      </Link>
                    </div>
                    <ChevronRight size={14} style={{ color: "#444", flexShrink: 0, marginTop: 2 }} />
                  </div>

                  {/* Excerpt */}
                  <p style={{ color: "#777", fontSize: 12, lineHeight: 1.55, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {doc.excerpt}
                  </p>

                  {/* Footer */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                    <span style={{ fontSize: 10, color: "#555", display: "flex", alignItems: "center", gap: 3 }}>
                      <Clock size={9} /> {timeAgo(doc.created_at)}
                    </span>
                    {doc.tools_used && doc.tools_used.length > 0 && (
                      <span style={{ fontSize: 10, color: "#a78bfa", display: "flex", alignItems: "center", gap: 3 }}>
                        <Zap size={9} /> {doc.tools_used.length} tool{doc.tools_used.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {doc.triggered_by === "manual" && (
                      <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.18)", fontWeight: 700 }}>⚡</span>
                    )}
                    <span style={{ fontSize: 10, color: "#444", marginLeft: "auto" }}>
                      {wordCount(doc.content)}w
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Load more */}
          {hasMore && (
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", padding: "0.75rem 0" }}>
              <button
                onClick={() => fetchDocs(false)}
                disabled={loadingMore}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#666", cursor: loadingMore ? "default" : "pointer", padding: "8px 20px", fontSize: 12, fontWeight: 700 }}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Document Viewer Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <DocViewer doc={selected} agent={agentFor(selected.agent_id)} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
