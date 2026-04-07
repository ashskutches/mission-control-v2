"use client";
/**
 * TargetingRulesTab — Full-width rule library (accordion) + AI chat at the bottom
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, Send, Sparkles, Check, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TargetingRule {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  rule: Record<string, unknown>;
  icon: string;
  color: string;
  created_at: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestions?: SuggestedRule[];
}

interface SuggestedRule {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  rule: Record<string, unknown>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#38bdf8", "#34d399", "#f59e0b", "#f43f5e", "#a78bfa",
  "#fb923c", "#22d3ee", "#facc15", "#10b981", "#e879f9",
];

const labelStyle: React.CSSProperties = {
  fontSize: 10, color: "#64748b", textTransform: "uppercase",
  letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem", fontWeight: 700,
};
const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#e2e8f0", width: "100%",
};

// ── Inline Edit Form (rendered inside accordion) ──────────────────────────────

interface RuleFormProps {
  initial?: Partial<TargetingRule>;
  onSave: (data: Omit<TargetingRule, "id" | "created_at">) => Promise<void>;
  onCancel: () => void;
}

function RuleForm({ initial, onSave, onCancel }: RuleFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "🎯");
  const [color, setColor] = useState(initial?.color ?? "#38bdf8");
  const [ruleJson, setRuleJson] = useState(
    initial?.rule ? JSON.stringify(initial.rule, null, 2) : "{}"
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [slugEdited, setSlugEdited] = useState(!!initial?.slug);

  useEffect(() => {
    if (!slugEdited && name) {
      setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  }, [name, slugEdited]);

  const handleSave = async () => {
    setError("");
    let rule: Record<string, unknown> = {};
    try { rule = JSON.parse(ruleJson); } catch { setError("Rule JSON is not valid JSON."); return; }
    if (!name.trim()) { setError("Name is required."); return; }
    if (!slug.trim()) { setError("Slug is required."); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), slug: slug.trim(), description: description.trim() || null as any, rule, icon, color });
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const KEY_REFERENCE = [
    { key: "pain", eg: '["knee","back","shoulder"]' },
    { key: "motivation", eg: '["performance","wellness"]' },
    { key: "life_stage", eg: '["senior","athlete"]' },
    { key: "decision_style", eg: '["social_proof","urgency"]' },
    { key: "tags", eg: '["first_visit","cart_abandoner"]' },
    { key: "identified", eg: "true" },
    { key: "min_confidence", eg: "0.6" },
    { key: "ad_signals", eg: '{"utm_source":"facebook"}' },
  ];

  return (
    <div style={{ padding: "0.85rem 1rem 0.75rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Row 1: Icon + Name + Slug */}
      <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.6rem" }}>
        <div style={{ flex: "0 0 48px" }}>
          <label style={labelStyle}>Icon</label>
          <input value={icon} onChange={e => setIcon(e.target.value)}
            style={{ ...inputStyle, textAlign: "center", fontSize: 18, padding: "0.25rem", borderRadius: 6 }}
            maxLength={4} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Name</label>
          <input className="input is-small" placeholder="Knee Pain Sufferers"
            value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: "0 0 160px" }}>
          <label style={labelStyle}>Slug</label>
          <input className="input is-small" placeholder="knee-pain"
            value={slug}
            onChange={e => { setSlugEdited(true); setSlug(e.target.value); }}
            style={{ ...inputStyle, fontFamily: "monospace", fontSize: 11 }} />
        </div>
      </div>

      {/* Row 2: Description + Color */}
      <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.6rem", alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Description</label>
          <input className="input is-small" placeholder="Visitors who have signaled knee or joint pain"
            value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Color</label>
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", maxWidth: 180 }}>
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 18, height: 18, borderRadius: "50%", background: c,
                border: `2px solid ${color === c ? "#fff" : "transparent"}`,
                cursor: "pointer", padding: 0, transition: "border 0.1s", flexShrink: 0,
              }} aria-label={c} />
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Rule JSON */}
      <div style={{ marginBottom: "0.6rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Rule JSON</label>
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
            {KEY_REFERENCE.map(r => (
              <span key={r.key} style={{
                fontSize: 9, color: "#38bdf8", background: "rgba(56,189,248,0.08)",
                border: "1px solid rgba(56,189,248,0.15)", borderRadius: 4, padding: "1px 5px",
                fontFamily: "monospace", cursor: "default",
              }} title={r.eg}>{r.key}</span>
            ))}
          </div>
        </div>
        <textarea className="textarea is-small" rows={3}
          value={ruleJson} onChange={e => setRuleJson(e.target.value)}
          style={{ ...inputStyle, fontFamily: "monospace", fontSize: 11, resize: "vertical" }}
          placeholder='{"pain": ["knee", "joint"]}' />
      </div>

      {error && <p style={{ fontSize: 11, color: "#f43f5e", marginBottom: "0.4rem" }}>⚠ {error}</p>}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={handleSave} disabled={saving} className="button is-small"
          style={{ background: "rgba(56,189,248,0.15)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)", fontWeight: 700 }}>
          {saving ? "Saving..." : "Save Rule"}
        </button>
        <button onClick={onCancel} className="button is-small is-ghost" style={{ color: "#475569" }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Accordion Rule Row ────────────────────────────────────────────────────────

function RuleRow({ rule, onSave, onDelete }: {
  rule: TargetingRule;
  onSave: (id: string, data: Omit<TargetingRule, "id" | "created_at">) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ruleKeys = Object.keys(rule.rule).join(", ");

  return (
    <motion.div layout="position" style={{
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      background: expanded ? "rgba(255,255,255,0.025)" : "transparent",
      transition: "background 0.15s",
    }}>
      {/* ── Compact row (always visible) ──────────────────────────────────── */}
      <div
        onClick={() => { setExpanded(e => !e); setConfirming(false); }}
        style={{
          display: "flex", alignItems: "center", gap: "0.6rem",
          padding: "0.45rem 0.85rem", cursor: "pointer",
          userSelect: "none",
        }}
      >
        {/* Color bar */}
        <div style={{ width: 3, height: 28, borderRadius: 2, background: rule.color, flexShrink: 0 }} />

        {/* Icon */}
        <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1, width: 22, textAlign: "center" }}>
          {rule.icon}
        </span>

        {/* Name */}
        <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 12.5, flexShrink: 0, minWidth: 160 }}>
          {rule.name}
        </span>

        {/* Slug */}
        <code style={{
          fontSize: 9, fontFamily: "monospace", color: rule.color,
          background: `${rule.color}12`, border: `1px solid ${rule.color}22`,
          borderRadius: 4, padding: "1px 6px", flexShrink: 0,
        }}>{rule.slug}</code>

        {/* Keys preview */}
        <span style={{ fontSize: 10, color: "#475569", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ruleKeys || "{}"}
        </span>

        {/* Actions — stop propagation so row click doesn't toggle */}
        <div style={{ display: "flex", gap: "0.15rem", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {confirming ? (
            <>
              <button onClick={() => onDelete(rule.id)}
                style={{ fontSize: 10, fontWeight: 700, color: "#f43f5e", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 5, padding: "2px 7px", cursor: "pointer" }}>
                Delete
              </button>
              <button onClick={() => setConfirming(false)}
                style={{ fontSize: 10, color: "#64748b", background: "none", border: "none", cursor: "pointer" }}>
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)}
              style={{ color: "#334155", background: "none", border: "none", cursor: "pointer", padding: "0.2rem", lineHeight: 1 }}
              aria-label="Delete rule">
              <Trash2 size={12} />
            </button>
          )}
        </div>

        {/* Chevron */}
        <span style={{ color: "#334155", flexShrink: 0, lineHeight: 1 }}>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </div>

      {/* ── Expanded: inline edit form ─────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            style={{ overflow: "hidden" }}
          >
            <RuleForm
              initial={rule}
              onSave={async data => { await onSave(rule.id, data); setExpanded(false); }}
              onCancel={() => setExpanded(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── New Rule accordion row ─────────────────────────────────────────────────────

function NewRuleRow({ prefill, onSave, onCancel }: {
  prefill?: Partial<TargetingRule> | null;
  onSave: (data: Omit<TargetingRule, "id" | "created_at">) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(56,189,248,0.03)",
        border: "1px solid rgba(56,189,248,0.15)",
        borderRadius: 8, marginBottom: "0.3rem",
      }}>
      <div style={{ padding: "0.4rem 0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          + New Rule
        </span>
      </div>
      <RuleForm initial={prefill ?? undefined} onSave={onSave} onCancel={onCancel} />
    </motion.div>
  );
}

// ── AI Suggest Chat ───────────────────────────────────────────────────────────

function SuggestChat({ onAddRule }: { onAddRule: (rule: SuggestedRule) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: "assistant",
    content: "Describe your target audience and I'll suggest ready-to-use rules.\n\nTry: *\"Target older visitors who clicked our knee pain Facebook ads\"*",
  }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setSending(true);
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${BOT_URL}/admin/intelligence/targeting-rules/suggest`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setMessages(prev => [...prev, { role: "assistant", content: data.reply, suggestions: data.suggestions ?? [] }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠ ${e.message}` }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem 1rem", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "80%",
                background: msg.role === "user" ? "rgba(56,189,248,0.1)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${msg.role === "user" ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                padding: "0.5rem 0.75rem", fontSize: 12, color: "#e2e8f0", lineHeight: 1.6, whiteSpace: "pre-wrap",
              }}>
                {msg.content.replace(/```rule[\s\S]*?```/g, "").trim()}
              </div>
            </div>
            {msg.suggestions && msg.suggestions.length > 0 && (
              <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {msg.suggestions.map((s, si) => (
                  <motion.div key={si} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    style={{
                      background: `${s.color ?? "#38bdf8"}0e`, border: `1px solid ${s.color ?? "#38bdf8"}28`,
                      borderRadius: 8, padding: "0.5rem 0.75rem",
                      display: "flex", alignItems: "center", gap: "0.5rem",
                    }}>
                    <span style={{ fontSize: 16 }}>{s.icon ?? "🎯"}</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 12, margin: 0 }}>{s.name}</p>
                      <code style={{ fontSize: 10, color: "#475569" }}>{JSON.stringify(s.rule)}</code>
                    </div>
                    <button onClick={() => onAddRule(s)}
                      style={{
                        background: `${s.color ?? "#38bdf8"}18`, border: `1px solid ${s.color ?? "#38bdf8"}35`,
                        color: s.color ?? "#38bdf8", borderRadius: 6, padding: "3px 9px",
                        cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
                      }}>
                      + Add
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div style={{ display: "flex", gap: 4, padding: "2px 0" }}>
            {[0, 1, 2].map(i => (
              <motion.span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#38bdf8", display: "block" }}
                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "0.55rem 0.75rem", display: "flex", gap: "0.5rem" }}>
        <input className="input is-small"
          placeholder='e.g. "Seniors 50+ with back pain from Facebook"'
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
          disabled={sending} />
        <button onClick={send} disabled={sending || !input.trim()}
          style={{
            width: 30, height: 30, borderRadius: 7, background: "rgba(56,189,248,0.14)",
            border: "1px solid rgba(56,189,248,0.22)", color: "#38bdf8",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: sending || !input.trim() ? "not-allowed" : "pointer",
            opacity: sending || !input.trim() ? 0.5 : 1, padding: 0, flexShrink: 0,
          }} aria-label="Send">
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TargetingRulesTab() {
  const [rules, setRules] = useState<TargetingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newPrefill, setNewPrefill] = useState<Partial<TargetingRule> | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/targeting-rules`);
      const data = await res.json();
      setRules(data.rules ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleSaveNew = async (data: Omit<TargetingRule, "id" | "created_at">) => {
    const res = await fetch(`${BOT_URL}/admin/intelligence/targeting-rules`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
    setShowNewForm(false); setNewPrefill(null); fetchRules();
  };

  const handleSaveEdit = async (id: string, data: Omit<TargetingRule, "id" | "created_at">) => {
    const res = await fetch(`${BOT_URL}/admin/intelligence/targeting-rules/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
    fetchRules();
  };

  const handleDelete = async (id: string) => {
    await fetch(`${BOT_URL}/admin/intelligence/targeting-rules/${id}`, { method: "DELETE" });
    fetchRules();
  };

  const handleAddSuggestion = (s: SuggestedRule) => {
    setNewPrefill(s as Partial<TargetingRule>);
    setShowNewForm(true);
    // scroll to top of list
    document.getElementById("lrb-rules-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── Rule Library ─────────────────────────────────────────────────────── */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12, overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.75rem 1rem",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.15)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <p style={{ fontWeight: 800, color: "#e2e8f0", fontSize: 13, margin: 0 }}>Rule Library</p>
            <span style={{
              fontSize: 9, fontWeight: 700, background: "rgba(56,189,248,0.1)",
              color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)",
              borderRadius: 10, padding: "1px 7px",
            }}>{rules.length}</span>
            <span style={{ fontSize: 10, color: "#475569" }}>Click a rule to expand and edit</span>
          </div>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button onClick={fetchRules} className="button is-small is-ghost" style={{ color: "#475569" }} aria-label="Refresh">
              <RefreshCw size={12} />
            </button>
            <button
              onClick={() => { setNewPrefill(null); setShowNewForm(v => !v); }}
              className="button is-small"
              style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)", gap: "0.35rem", display: "flex", alignItems: "center", fontSize: 11 }}>
              <Plus size={11} /> New Rule
            </button>
          </div>
        </div>

        {/* New rule row */}
        <div id="lrb-rules-list">
          <AnimatePresence>
            {showNewForm && (
              <NewRuleRow
                prefill={newPrefill}
                onSave={handleSaveNew}
                onCancel={() => { setShowNewForm(false); setNewPrefill(null); }}
              />
            )}
          </AnimatePresence>

          {/* Column headers */}
          {rules.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: "0.6rem",
              padding: "0.3rem 0.85rem",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              background: "rgba(0,0,0,0.1)",
            }}>
              <div style={{ width: 3, flexShrink: 0 }} />
              <div style={{ width: 22, flexShrink: 0 }} />
              <span style={{ minWidth: 160, fontSize: 9, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Name</span>
              <span style={{ fontSize: 9, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, width: 110, flexShrink: 0 }}>Slug</span>
              <span style={{ fontSize: 9, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, flex: 1 }}>Rule Keys</span>
            </div>
          )}

          {/* Rule rows */}
          {loading ? (
            <p style={{ color: "#475569", textAlign: "center", padding: "2rem", fontSize: 12 }}>Loading...</p>
          ) : rules.length === 0 && !showNewForm ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", opacity: 0.5 }}>
              <Sparkles size={24} color="#334155" style={{ margin: "0 auto 0.75rem" }} />
              <p style={{ color: "#475569", fontSize: 13, marginBottom: "0.4rem" }}>No targeting rules yet.</p>
              <p style={{ color: "#334155", fontSize: 11 }}>Click "New Rule" or ask the AI assistant below.</p>
            </div>
          ) : (
            rules.map(r => (
              <RuleRow key={r.id} rule={r} onSave={handleSaveEdit} onDelete={handleDelete} />
            ))
          )}
        </div>
      </div>

      {/* ── AI Suggest Chat ───────────────────────────────────────────────────── */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(56,189,248,0.12)",
        borderRadius: 12, overflow: "hidden",
        height: 340,
        display: "flex", flexDirection: "column",
      }}>
        {/* Chat header */}
        <div style={{
          padding: "0.65rem 1rem",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0,
          background: "rgba(0,0,0,0.15)",
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: 7,
            background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Sparkles size={12} color="#38bdf8" />
          </div>
          <div>
            <p style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 12, margin: 0, lineHeight: 1 }}>Rule Suggestions</p>
            <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>Describe your audience — AI generates ready-to-use rules</p>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <SuggestChat onAddRule={handleAddSuggestion} />
        </div>
      </div>
    </div>
  );
}
