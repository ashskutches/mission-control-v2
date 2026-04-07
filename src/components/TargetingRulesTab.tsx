"use client";
/**
 * TargetingRulesTab — Named rule library + AI suggest chat
 * Lives inside the Audience page as the "Targeting Rules" tab.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, Send, Sparkles, Check, X, RefreshCw } from "lucide-react";

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

const CARD = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "1rem",
} as const;

// ── Rule Form ─────────────────────────────────────────────────────────────────

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

  // Auto-derive slug from name unless user has manually edited it
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const KEY_REFERENCE = [
    { key: "pain", type: "string[]", eg: '["knee","back","shoulder"]' },
    { key: "motivation", type: "string[]", eg: '["performance","wellness"]' },
    { key: "life_stage", type: "string[]", eg: '["senior","athlete"]' },
    { key: "decision_style", type: "string[]", eg: '["social_proof","urgency"]' },
    { key: "tags", type: "string[]", eg: '["first_visit","cart_abandoner"]' },
    { key: "identified", type: "boolean", eg: "true" },
    { key: "min_confidence", type: "0–1", eg: "0.6" },
    { key: "ad_signals", type: "object", eg: '{"utm_source":"facebook"}' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      style={{ ...CARD, border: "1px solid rgba(56,189,248,0.2)", marginBottom: "1rem" }}
    >
      <p style={{ fontSize: 12, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>
        {initial?.id ? "Edit Rule" : "New Targeting Rule"}
      </p>

      {/* Name + Icon row */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div style={{ flex: "0 0 52px" }}>
          <label style={labelStyle}>Icon</label>
          <input
            value={icon} onChange={e => setIcon(e.target.value)}
            style={{ ...inputStyle, textAlign: "center", fontSize: 20, padding: "0.3rem" }}
            maxLength={4}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Name</label>
          <input className="input is-small" placeholder="Knee Pain Sufferers"
            value={name} onChange={e => setName(e.target.value)}
            style={inputStyle} />
        </div>
        <div style={{ flex: "0 0 120px" }}>
          <label style={labelStyle}>Slug</label>
          <input className="input is-small" placeholder="knee-pain"
            value={slug}
            onChange={e => { setSlugEdited(true); setSlug(e.target.value); }}
            style={{ ...inputStyle, fontFamily: "monospace", fontSize: 11 }} />
        </div>
      </div>

      {/* Description */}
      <div style={{ marginBottom: "0.75rem" }}>
        <label style={labelStyle}>Description (optional)</label>
        <input className="input is-small" placeholder="Visitors who have signaled knee or joint pain"
          value={description} onChange={e => setDescription(e.target.value)}
          style={inputStyle} />
      </div>

      {/* Color */}
      <div style={{ marginBottom: "0.75rem" }}>
        <label style={labelStyle}>Color</label>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{
              width: 22, height: 22, borderRadius: "50%", background: c, border: `2px solid ${color === c ? "#fff" : "transparent"}`,
              cursor: "pointer", padding: 0, transition: "border 0.1s",
            }} aria-label={c} />
          ))}
        </div>
      </div>

      {/* Rule JSON with key reference */}
      <div style={{ marginBottom: "0.75rem" }}>
        <label style={labelStyle}>Targeting Rule (JSON)</label>
        <div style={{
          background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 8, padding: "0.6rem 0.75rem", marginBottom: "0.4rem",
          fontSize: 10, display: "flex", gap: "0.5rem", flexWrap: "wrap",
        }}>
          {KEY_REFERENCE.map(r => (
            <span key={r.key} style={{ color: "#94a3b8" }}>
              <span style={{ color: "#38bdf8", fontFamily: "monospace" }}>{r.key}</span>
              <span style={{ color: "#475569" }}> ({r.type})</span>
            </span>
          ))}
        </div>
        <textarea className="textarea is-small" rows={4}
          value={ruleJson} onChange={e => setRuleJson(e.target.value)}
          style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
          placeholder='{"pain": ["knee", "joint"]}' />
      </div>

      {error && <p style={{ fontSize: 11, color: "#f43f5e", marginBottom: "0.5rem" }}>⚠ {error}</p>}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={handleSave} disabled={saving} className="button is-small"
          style={{ background: "rgba(56,189,248,0.15)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)", fontWeight: 700 }}>
          {saving ? "Saving..." : "Save Rule"}
        </button>
        <button onClick={onCancel} className="button is-small is-ghost" style={{ color: "#475569" }}>Cancel</button>
      </div>
    </motion.div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em",
  display: "block", marginBottom: "0.3rem", fontWeight: 700,
};
const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#e2e8f0", width: "100%",
};

// ── Rule Card ─────────────────────────────────────────────────────────────────

function RuleCard({ rule, onEdit, onDelete }: {
  rule: TargetingRule;
  onEdit: (r: TargetingRule) => void;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const rulePreview = JSON.stringify(rule.rule);
  const truncated = rulePreview.length > 60 ? rulePreview.slice(0, 60) + "…" : rulePreview;

  return (
    <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${rule.color}20`,
        borderLeft: `3px solid ${rule.color}`,
        borderRadius: 10,
        padding: "0.65rem 0.85rem",
        display: "flex", alignItems: "center", gap: "0.65rem",
      }}>
      {/* Icon */}
      <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{rule.icon}</span>

      {/* Name + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13, marginBottom: 2, lineHeight: 1 }}>{rule.name}</p>
        {rule.description && (
          <p style={{ fontSize: 11, color: "#64748b", marginBottom: 3, lineHeight: 1.4 }}>{rule.description}</p>
        )}
        <code style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>{truncated}</code>
      </div>

      {/* Slug pill */}
      <span style={{
        fontSize: 9, fontFamily: "monospace", color: rule.color,
        background: `${rule.color}12`, border: `1px solid ${rule.color}25`,
        borderRadius: 4, padding: "2px 7px", fontWeight: 700, flexShrink: 0,
      }}>{rule.slug}</span>

      {/* Actions */}
      {confirming ? (
        <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
          <button onClick={() => onDelete(rule.id)} style={{ color: "#f43f5e", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
            Delete
          </button>
          <button onClick={() => setConfirming(false)} style={{ color: "#64748b", background: "none", border: "none", cursor: "pointer", fontSize: 11 }}>
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "0.1rem", flexShrink: 0 }}>
          <button onClick={() => onEdit(rule)} style={{ color: "#38bdf8", background: "none", border: "none", cursor: "pointer", padding: "0.2rem" }} aria-label="Edit">
            <Edit2 size={13} />
          </button>
          <button onClick={() => setConfirming(true)} style={{ color: "#f43f5e", background: "none", border: "none", cursor: "pointer", padding: "0.2rem" }} aria-label="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── AI Suggest Chat ───────────────────────────────────────────────────────────

function SuggestChat({ onAddRule }: { onAddRule: (rule: SuggestedRule) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: "assistant",
    content: "Hey! Tell me about the audience you want to target and I'll suggest some ready-to-use rules.\n\nFor example: *\"I want to target older visitors who came from our knee pain Facebook ads\"*",
  }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);
    try {
      const history = messages.filter(m => m.role === "user" || m.role === "assistant").map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${BOT_URL}/admin/intelligence/targeting-rules/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setMessages(prev => [...prev, { role: "assistant", content: data.reply, suggestions: data.suggestions ?? [] }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠ Error: ${e.message}` }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: "0.85rem" }}>
            <div style={{
              display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}>
              <div style={{
                maxWidth: "90%",
                background: msg.role === "user" ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${msg.role === "user" ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                padding: "0.6rem 0.85rem",
                fontSize: 12, color: "#e2e8f0", lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}>
                {/* Strip ```rule ... ``` blocks — they'll render as suggestion cards below */}
                {msg.content.replace(/```rule[\s\S]*?```/g, "").trim()}
              </div>
            </div>

            {/* Suggestion cards */}
            {msg.suggestions && msg.suggestions.length > 0 && (
              <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {msg.suggestions.map((s, si) => (
                  <motion.div key={si} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    style={{
                      background: `${s.color ?? "#38bdf8"}10`,
                      border: `1px solid ${s.color ?? "#38bdf8"}30`,
                      borderRadius: 10, padding: "0.65rem 0.85rem",
                      display: "flex", alignItems: "flex-start", gap: "0.65rem",
                    }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon ?? "🎯"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 12, marginBottom: 2 }}>{s.name}</p>
                      {s.description && <p style={{ fontSize: 11, color: "#64748b", marginBottom: 6, lineHeight: 1.4 }}>{s.description}</p>}
                      <code style={{ fontSize: 10, color: "#475569" }}>{JSON.stringify(s.rule)}</code>
                    </div>
                    <button onClick={() => onAddRule(s)}
                      style={{
                        flexShrink: 0, background: `${s.color ?? "#38bdf8"}18`,
                        border: `1px solid ${s.color ?? "#38bdf8"}35`,
                        color: s.color ?? "#38bdf8", borderRadius: 8,
                        padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700,
                        display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
                      }}>
                      <Plus size={11} /> Add
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div style={{ display: "flex", gap: 4, padding: "4px 0" }}>
            {[0, 1, 2].map(i => (
              <motion.span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#38bdf8", display: "block" }}
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.07)",
        padding: "0.65rem",
        display: "flex", gap: "0.5rem", alignItems: "center",
      }}>
        <input
          className="input is-small"
          placeholder='e.g. "People 50+ with back pain from Facebook"'
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
          disabled={sending}
        />
        <button onClick={send} disabled={sending || !input.trim()}
          style={{
            width: 32, height: 32, borderRadius: 8, background: "rgba(56,189,248,0.15)",
            border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: sending || !input.trim() ? "not-allowed" : "pointer", opacity: sending || !input.trim() ? 0.5 : 1,
            padding: 0, flexShrink: 0,
          }}
          aria-label="Send">
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface TargetingRulesTabProps {
  /** Pre-fills the "New Rule" form with a suggestion from the AI chat */
  prefillRule?: Partial<TargetingRule> | null;
}

export default function TargetingRulesTab({ prefillRule }: TargetingRulesTabProps) {
  const [rules, setRules] = useState<TargetingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<TargetingRule | null>(null);
  const [formPrefill, setFormPrefill] = useState<Partial<TargetingRule> | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/targeting-rules`);
      const data = await res.json();
      setRules(data.rules ?? []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  // Open the form pre-filled when a suggestion arrives from the chat
  useEffect(() => {
    if (prefillRule) {
      setEditTarget(null);
      setFormPrefill(prefillRule);
      setShowForm(true);
    }
  }, [prefillRule]);

  const openCreate = () => { setEditTarget(null); setFormPrefill(null); setShowForm(true); };
  const openEdit = (r: TargetingRule) => { setEditTarget(r); setFormPrefill(null); setShowForm(true); };

  const handleSave = async (data: Omit<TargetingRule, "id" | "created_at">) => {
    const url = editTarget
      ? `${BOT_URL}/admin/intelligence/targeting-rules/${editTarget.id}`
      : `${BOT_URL}/admin/intelligence/targeting-rules`;
    const method = editTarget ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
    setShowForm(false);
    fetchRules();
  };

  const handleDelete = async (id: string) => {
    await fetch(`${BOT_URL}/admin/intelligence/targeting-rules/${id}`, { method: "DELETE" });
    fetchRules();
  };

  const handleAddSuggestion = (s: SuggestedRule) => {
    setEditTarget(null);
    setFormPrefill(s as Partial<TargetingRule>);
    setShowForm(true);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "1.5rem", alignItems: "start" }}>

      {/* ── Left: Rule Library ───────────────────────────────────────────────── */}
      <div>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <p style={{ fontWeight: 800, color: "#e2e8f0", fontSize: 14, marginBottom: 2 }}>Rule Library</p>
            <p style={{ fontSize: 11, color: "#64748b" }}>
              {rules.length} named rule{rules.length !== 1 ? "s" : ""} — toggle these on sections to apply them
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={fetchRules} className="button is-small is-ghost" style={{ color: "#475569" }} aria-label="Refresh">
              <RefreshCw size={13} />
            </button>
            <button onClick={openCreate} className="button is-small"
              style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)", gap: "0.4rem", display: "flex", alignItems: "center" }}>
              <Plus size={13} /> New Rule
            </button>
          </div>
        </div>

        {/* Form */}
        <AnimatePresence>
          {showForm && (
            <RuleForm
              initial={editTarget ?? formPrefill ?? undefined}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditTarget(null); setFormPrefill(null); }}
            />
          )}
        </AnimatePresence>

        {/* List */}
        {loading ? (
          <p style={{ color: "#475569", textAlign: "center", padding: "2rem", fontSize: 13 }}>Loading rules...</p>
        ) : rules.length === 0 ? (
          <div style={{ ...CARD, textAlign: "center", padding: "3rem 2rem", opacity: 0.6 }}>
            <Sparkles size={28} color="#334155" style={{ margin: "0 auto 1rem" }} />
            <p style={{ color: "#475569", fontSize: 13, marginBottom: "0.5rem" }}>No targeting rules yet.</p>
            <p style={{ color: "#334155", fontSize: 12 }}>Create your first rule, or ask the AI assistant →</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <AnimatePresence>
              {rules.map(r => (
                <RuleCard key={r.id} rule={r} onEdit={openEdit} onDelete={handleDelete} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Right: AI Chat ───────────────────────────────────────────────────── */}
      <div style={{
        ...CARD,
        position: "sticky", top: 0,
        height: "calc(100vh - 140px)",
        display: "flex", flexDirection: "column",
        border: "1px solid rgba(56,189,248,0.15)",
        overflow: "hidden",
      }}>
        {/* Chat header */}
        <div style={{
          padding: "0.75rem 1rem",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={13} color="#38bdf8" />
          </div>
          <div>
            <p style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 12, margin: 0, lineHeight: 1 }}>Rule Suggestions</p>
            <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>Describe your audience in plain English</p>
          </div>
        </div>

        {/* Chat — fills remaining height */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <SuggestChat onAddRule={handleAddSuggestion} />
        </div>
      </div>
    </div>
  );
}
