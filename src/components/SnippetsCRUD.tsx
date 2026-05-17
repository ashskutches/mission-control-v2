"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2, Plus, Pencil, Trash2, RefreshCw, CheckCircle2,
  AlertCircle, ClipboardCopy, Check, X, FileCode, Rocket,
  ChevronRight, Search, Sparkles,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const ORANGE = "#e98d20";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(233,141,32,0.1)",
  borderRadius: 12,
  padding: "1rem",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase",
      letterSpacing: "0.08em", fontWeight: 700, display: "block", marginBottom: "0.4rem" }}>
      {children}
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8, padding: "0.5rem 0.65rem", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: 10, color: copied ? ORANGE : "#64748b", background: "none", border: "none", cursor: "pointer" }}>
      {copied ? <Check size={10} /> : <ClipboardCopy size={10} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Snippet {
  id: string;
  filename: string;
  size_bytes: number;
  lines: number;
  updated_at: string;
  description: string | null;
  preview: string;
}

interface SnippetFull extends Snippet {
  content: string;
}

type Mode = "list" | "edit" | "new";
type SaveState = "idle" | "saving" | "ok" | "error";

// ── Code Editor ───────────────────────────────────────────────────────────────

function CodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.75rem", background: "rgba(0,0,0,0.3)", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Code2 size={11} color="#64748b" />
          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>liquid</span>
        </div>
        <CopyButton text={value} />
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
        style={{
          width: "100%", minHeight: 420, background: "rgba(0,0,0,0.25)", color: "#94a3b8",
          fontSize: 12, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.7,
          padding: "1rem", border: "none", outline: "none", resize: "vertical", boxSizing: "border-box",
        }}
      />
    </div>
  );
}

// ── Snippet Card ──────────────────────────────────────────────────────────────

function SnippetCard({ snippet, onEdit, onDelete }: {
  snippet: Snippet;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const kb = (snippet.size_bytes / 1024).toFixed(1);
  const date = new Date(snippet.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{ ...CARD, cursor: "default", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ORANGE}15`,
          border: `1px solid ${ORANGE}25`, display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0 }}>
          <FileCode size={15} color={ORANGE} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", margin: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {snippet.filename}
          </p>
          <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>
            {snippet.lines} lines · {kb} KB · {date}
          </p>
        </div>
      </div>

      {snippet.description && (
        <p style={{ fontSize: 11, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
          {snippet.description}
        </p>
      )}

      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.2rem" }}>
        <button onClick={onEdit}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
            background: `${ORANGE}12`, border: `1px solid ${ORANGE}25`, borderRadius: 7, padding: "0.4rem",
            color: ORANGE, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          <Pencil size={11} /> Edit
        </button>
        {deleting ? (
          <div style={{ display: "flex", gap: "0.3rem" }}>
            <button onClick={() => setDeleting(false)}
              style={{ padding: "0.4rem 0.6rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, color: "#64748b", fontSize: 11, cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={onDelete}
              style={{ padding: "0.4rem 0.6rem", background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 7, color: "#f43f5e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Confirm
            </button>
          </div>
        ) : (
          <button onClick={() => setDeleting(true)}
            style={{ padding: "0.4rem 0.6rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, color: "#475569", fontSize: 11, cursor: "pointer" }}>
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Edit / New Panel ──────────────────────────────────────────────────────────

function EditPanel({ snippet, mode, onSave, onCancel }: {
  snippet: SnippetFull | null;
  mode: "edit" | "new";
  onSave: (filename: string, content: string, oldId?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [filename, setFilename] = useState(snippet?.filename ?? "lrb-");
  const [content, setContent] = useState(snippet?.content ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  const handleSave = async () => {
    setSaveState("saving");
    setError(null);
    try {
      await onSave(filename, content, mode === "edit" ? snippet?.id : undefined);
      setSaveState("ok");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (e: any) {
      setError(e.message);
      setSaveState("error");
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/ai/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are an expert Shopify Liquid developer for Leaps & Rebounds, a premium fitness rebounder brand. Output ONLY the .liquid file contents — no markdown, no preamble. Self-contained styles, no Glider.js." },
            { role: "user", content: aiPrompt },
          ],
          max_tokens: 4096,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      const raw = json.data?.content ?? json.data?.text ?? json.content ?? "";
      const cleaned = raw.replace(/^```(?:liquid|html)?\n?/m, "").replace(/```\s*$/m, "").trim();
      setContent(cleaned);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <button onClick={onCancel}
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.4rem 0.75rem", color: "#64748b", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <X size={12} /> Cancel
        </button>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#f0ede8", margin: 0 }}>
          {mode === "new" ? "New Snippet" : `Editing ${snippet?.filename}`}
        </h2>
      </div>

      <Field label="Filename">
        <input value={filename} onChange={e => setFilename(e.target.value)}
          placeholder="lrb-my-snippet.liquid"
          style={{ ...inputStyle }}
          onFocus={e => (e.currentTarget.style.borderColor = `${ORANGE}60`)}
          onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")} />
        <p style={{ fontSize: 10, color: "#475569", marginTop: "0.3rem" }}>Must start with <code style={{ color: ORANGE }}>lrb-</code> and end with <code style={{ color: ORANGE }}>.liquid</code></p>
      </Field>

      {/* AI Generate */}
      <div style={{ ...CARD, background: `${ORANGE}06`, border: `1px solid ${ORANGE}15` }}>
        <Label>✨ AI Generate (optional)</Label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
            placeholder="Describe what this snippet should do…"
            style={{ ...inputStyle, flex: 1 }}
            onKeyDown={e => e.key === "Enter" && handleAiGenerate()}
            onFocus={e => (e.currentTarget.style.borderColor = `${ORANGE}60`)}
            onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")} />
          <button onClick={handleAiGenerate} disabled={aiLoading || !aiPrompt.trim()}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: aiLoading ? "rgba(255,255,255,0.05)" : ORANGE,
              border: "none", borderRadius: 8, padding: "0.5rem 0.9rem", color: "#fff", fontSize: 12, fontWeight: 700, cursor: aiLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
            {aiLoading ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={12} />}
            {aiLoading ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>

      <Field label="Content">
        <CodeEditor value={content} onChange={setContent} />
      </Field>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 8, padding: "0.6rem 0.9rem" }}>
          <AlertCircle size={13} color="#f43f5e" />
          <span style={{ fontSize: 12, color: "#f43f5e" }}>{error}</span>
        </div>
      )}

      <button onClick={handleSave} disabled={saveState === "saving" || !filename || !content}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
          background: saveState === "ok" ? "#22c55e" : saveState === "saving" ? "rgba(255,255,255,0.06)" : ORANGE,
          border: "none", borderRadius: 10, padding: "0.75rem", color: "#fff", fontWeight: 800, fontSize: 14,
          cursor: saveState === "saving" ? "not-allowed" : "pointer", transition: "all 0.15s" }}>
        {saveState === "saving" && <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />}
        {saveState === "ok" && <CheckCircle2 size={14} />}
        {saveState === "idle" || saveState === "error" ? <Check size={14} /> : null}
        {saveState === "saving" ? "Saving…" : saveState === "ok" ? "Saved!" : "Save Snippet"}
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SnippetsCRUD() {
  const [mode, setMode] = useState<Mode>("list");
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSnippet, setActiveSnippet] = useState<SnippetFull | null>(null);
  const [search, setSearch] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployMsg, setDeployMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchSnippets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/snippets`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSnippets(json.snippets ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSnippets(); }, [fetchSnippets]);

  const openEdit = async (snippet: Snippet) => {
    try {
      const res = await fetch(`${BOT_URL}/admin/snippets/${snippet.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setActiveSnippet(json);
      setMode("edit");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${BOT_URL}/admin/snippets/${id}`, { method: "DELETE" });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      setSnippets(prev => prev.filter(s => s.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSave = async (filename: string, content: string, oldId?: string) => {
    if (oldId) {
      const res = await fetch(`${BOT_URL}/admin/snippets/${oldId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, new_filename: filename }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    } else {
      const res = await fetch(`${BOT_URL}/admin/snippets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, content }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    }
    await fetchSnippets();
    setMode("list");
    setActiveSnippet(null);
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setDeployMsg(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/theme/deploy`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDeployMsg({ ok: true, text: `Deployed ${json.deployed?.length ?? 0} assets to dev theme` });
    } catch (e: any) {
      setDeployMsg({ ok: false, text: e.message });
    } finally {
      setDeploying(false);
    }
  };

  const filtered = snippets.filter(s =>
    !search || s.filename.toLowerCase().includes(search.toLowerCase()) ||
    (s.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <AnimatePresence mode="wait">
        {mode === "list" ? (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
                <Search size={13} color="#475569" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={`Search ${snippets.length} snippets…`}
                  style={{ ...inputStyle, paddingLeft: 30 }} />
              </div>
              <button onClick={fetchSnippets} disabled={loading}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.5rem 0.75rem", color: "#64748b", fontSize: 12, cursor: "pointer" }}>
                <RefreshCw size={12} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
                Refresh
              </button>
              <button onClick={handleDeploy} disabled={deploying}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 8, padding: "0.5rem 0.9rem", color: "#22c55e", fontSize: 12, fontWeight: 700, cursor: deploying ? "not-allowed" : "pointer" }}>
                {deploying ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Rocket size={12} />}
                {deploying ? "Deploying…" : "Deploy All"}
              </button>
              <button onClick={() => { setActiveSnippet(null); setMode("new"); }}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: ORANGE, border: "none", borderRadius: 8, padding: "0.5rem 1rem", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                <Plus size={12} /> New Snippet
              </button>
            </div>

            {/* Deploy status */}
            <AnimatePresence>
              {deployMsg && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem",
                    background: deployMsg.ok ? "rgba(34,197,94,0.08)" : "rgba(244,63,94,0.08)",
                    border: `1px solid ${deployMsg.ok ? "rgba(34,197,94,0.25)" : "rgba(244,63,94,0.25)"}`,
                    borderRadius: 8, padding: "0.6rem 0.9rem" }}>
                  {deployMsg.ok ? <CheckCircle2 size={13} color="#22c55e" /> : <AlertCircle size={13} color="#f43f5e" />}
                  <span style={{ fontSize: 12, color: deployMsg.ok ? "#22c55e" : "#f43f5e" }}>{deployMsg.text}</span>
                  <button onClick={() => setDeployMsg(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#475569" }}><X size={11} /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 8, padding: "0.6rem 0.9rem", marginBottom: "1rem" }}>
                <AlertCircle size={13} color="#f43f5e" />
                <span style={{ fontSize: 12, color: "#f43f5e" }}>{error}</span>
              </div>
            )}

            {/* Grid */}
            {loading ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "#475569" }}>
                <RefreshCw size={20} color={ORANGE} style={{ animation: "spin 1s linear infinite", marginBottom: "0.75rem" }} />
                <p style={{ fontSize: 13 }}>Loading snippets…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "#475569" }}>
                <FileCode size={28} color="#334155" style={{ marginBottom: "0.75rem" }} />
                <p style={{ fontSize: 13 }}>{search ? "No snippets match your search." : "No snippets yet. Create your first one."}</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
                {filtered.map(s => (
                  <SnippetCard key={s.id} snippet={s}
                    onEdit={() => openEdit(s)}
                    onDelete={() => handleDelete(s.id)} />
                ))}
              </div>
            )}

            {/* Stats footer */}
            {!loading && snippets.length > 0 && (
              <p style={{ fontSize: 10, color: "#334155", marginTop: "1.25rem", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {snippets.length} snippets · {(snippets.reduce((a, s) => a + s.size_bytes, 0) / 1024).toFixed(1)} KB total
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EditPanel
              snippet={activeSnippet}
              mode={mode as "edit" | "new"}
              onSave={handleSave}
              onCancel={() => { setMode("list"); setActiveSnippet(null); }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
