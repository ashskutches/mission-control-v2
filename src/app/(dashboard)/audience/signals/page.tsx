"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Plus, Edit2, Trash2, Check, X, Clock } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

interface SignalDef {
  id: string; key: string; label: string; description: string | null;
  icon: string; color: string;
  trigger_type: "utm" | "page_view" | "time_based" | "manual" | "webhook";
  trigger_config: Record<string, unknown>;
  expires_after_ms: number | null;
  active: boolean; created_at: string;
}

const CARD = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "1.25rem" } as const;
const INPUT_STYLE = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" } as const;
const TRIGGER_COLORS: Record<string, string> = { utm: "#f59e0b", page_view: "#38bdf8", time_based: "#a78bfa", manual: "#64748b", webhook: "#34d399" };
const TRIGGER_LABELS: Record<string, string> = { utm: "UTM", page_view: "Page View", time_based: "Time-Based", manual: "Manual", webhook: "Webhook" };

function SignalTriggerFields({ form, setForm }: { form: any; setForm: any }) {
  const type = form.trigger_type;
  return (
    <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {type === "utm" && (
        <>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>UTM Param</label>
            <input className="input is-small" placeholder="utm_campaign" style={INPUT_STYLE}
              value={form.trigger_config?.param ?? ""}
              onChange={e => setForm((f: any) => ({ ...f, trigger_config: { ...f.trigger_config, param: e.target.value } }))} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>UTM Value (contains)</label>
            <input className="input is-small" placeholder="knee_pain" style={INPUT_STYLE}
              value={form.trigger_config?.value ?? ""}
              onChange={e => setForm((f: any) => ({ ...f, trigger_config: { ...f.trigger_config, value: e.target.value } }))} />
          </div>
        </>
      )}
      {type === "page_view" && (
        <div>
          <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>URL Contains</label>
          <input className="input is-small" placeholder="/blogs/joint-health" style={INPUT_STYLE}
            value={form.trigger_config?.url_contains ?? ""}
            onChange={e => setForm((f: any) => ({ ...f, trigger_config: { url_contains: e.target.value } }))} />
        </div>
      )}
      {type === "time_based" && (
        <div>
          <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Expires After (ms, leave blank = never)</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {[{ label: "1 hour", ms: 3600000 }, { label: "24 hours", ms: 86400000 }, { label: "7 days", ms: 604800000 }, { label: "Never", ms: null }].map(opt => (
              <button key={opt.label}
                onClick={() => setForm((f: any) => ({ ...f, expires_after_ms: opt.ms, trigger_config: opt.ms ? { expires_after_ms: opt.ms } : {} }))}
                style={{ fontSize: 10, padding: "0.2rem 0.6rem", borderRadius: 6, cursor: "pointer", fontWeight: 600, background: form.expires_after_ms === opt.ms ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)", color: form.expires_after_ms === opt.ms ? "#a78bfa" : "#64748b", border: form.expires_after_ms === opt.ms ? "1px solid rgba(167,139,250,0.3)" : "1px solid rgba(255,255,255,0.06)" }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<SignalDef[]>([]);
  const [loading, setLoading] = useState(true);
  const emptyForm = { key: "", label: "", description: "", icon: "🎯", color: "#38bdf8", trigger_type: "manual", trigger_config: {}, expires_after_ms: null as number | null };
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<SignalDef | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/signals`);
      if (res.ok) { const data = await res.json(); setSignals(data.signals ?? []); }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setFormError(""); setShowForm(true); };
  const openEdit = (s: SignalDef) => { setEditTarget(s); setForm({ key: s.key, label: s.label, description: s.description ?? "", icon: s.icon, color: s.color, trigger_type: s.trigger_type, trigger_config: s.trigger_config, expires_after_ms: s.expires_after_ms }); setFormError(""); setShowForm(true); };

  const save = async () => {
    setSaving(true); setFormError("");
    try {
      if (!form.key || !form.label) throw new Error("Key and label are required");
      const url = editTarget ? `${BOT_URL}/admin/intelligence/signals/${editTarget.id}` : `${BOT_URL}/admin/intelligence/signals`;
      const res = await fetch(url, { method: editTarget ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setShowForm(false); fetchSignals();
    } catch (e: any) { setFormError(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this signal?")) return;
    await fetch(`${BOT_URL}/admin/intelligence/signals/${id}`, { method: "DELETE" });
    fetchSignals();
  };

  const toggleActive = async (s: SignalDef) => {
    await fetch(`${BOT_URL}/admin/intelligence/signals/${s.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !s.active }) });
    fetchSignals();
  };

  return (
    <div>
      <div style={{ ...CARD, marginBottom: "1.25rem", border: "1px solid rgba(56,189,248,0.12)" }}>
        <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>
          <strong style={{ color: "#e2e8f0" }}>Signals</strong> are behavioral tags assigned to visitor profiles. The snippet auto-applies UTM, page-view, and time-based signals on page load.
        </p>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <p style={{ fontSize: 12, color: "#64748b" }}>{signals.length} signal{signals.length !== 1 ? "s" : ""} defined</p>
        <button onClick={openCreate} className="button is-small" style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)", gap: "0.4rem", display: "flex", alignItems: "center" }}>
          <Plus size={13} /> New Signal
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ ...CARD, marginBottom: "1rem", border: "1px solid rgba(56,189,248,0.2)" }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>{editTarget ? "Edit Signal" : "New Signal"}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {[{ key: "key", label: "Key (slug)", placeholder: "knee_pain" }, { key: "label", label: "Label", placeholder: "Knee Pain Signal" }, { key: "icon", label: "Icon (emoji)", placeholder: "🦵" }, { key: "color", label: "Color (hex)", placeholder: "#f59e0b" }].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>{label}</label>
                  <input className="input is-small" placeholder={placeholder} value={form[key] ?? ""} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))} style={INPUT_STYLE} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Description (optional)</label>
              <input className="input is-small" placeholder="Set when visitor arrives from a knee pain ad..." value={form.description ?? ""} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} style={INPUT_STYLE} />
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.5rem" }}>Trigger Type</label>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {(["utm", "page_view", "time_based", "manual", "webhook"] as const).map(t => (
                  <button key={t} onClick={() => setForm((f: any) => ({ ...f, trigger_type: t, trigger_config: {}, expires_after_ms: null }))}
                    style={{ fontSize: 10, padding: "0.25rem 0.7rem", borderRadius: 6, cursor: "pointer", fontWeight: 700, background: form.trigger_type === t ? `${TRIGGER_COLORS[t]}15` : "rgba(255,255,255,0.04)", color: form.trigger_type === t ? TRIGGER_COLORS[t] : "#64748b", border: form.trigger_type === t ? `1px solid ${TRIGGER_COLORS[t]}40` : "1px solid rgba(255,255,255,0.06)" }}>
                    {TRIGGER_LABELS[t]}
                  </button>
                ))}
              </div>
              <SignalTriggerFields form={form} setForm={setForm} />
            </div>
            {formError && <p style={{ fontSize: 12, color: "#f43f5e", marginTop: "0.5rem" }}>⚠ {formError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button onClick={save} disabled={saving} className="button is-small" style={{ background: "rgba(56,189,248,0.15)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)", fontWeight: 700 }}>
                {saving ? "Saving..." : editTarget ? "Save Changes" : "Create Signal"}
              </button>
              <button onClick={() => setShowForm(false)} className="button is-small is-ghost" style={{ color: "#475569" }}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? <p style={{ color: "#475569", textAlign: "center", padding: "2rem" }}>Loading signals...</p>
        : signals.length === 0 ? (
          <div style={{ ...CARD, textAlign: "center", padding: "3rem" }}>
            <Radio size={32} color="#334155" style={{ margin: "0 auto 1rem" }} />
            <p style={{ color: "#475569" }}>No signals defined yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {signals.map(s => (
              <motion.div key={s.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                style={{ ...CARD, padding: "0.6rem 0.85rem", borderLeft: `3px solid ${s.active ? s.color : "#334155"}`, opacity: s.active ? 1 : 0.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>{s.label}</span>
                      <code style={{ fontSize: 9, color: "#475569", background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 4 }}>{s.key}</code>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: `${TRIGGER_COLORS[s.trigger_type]}15`, color: TRIGGER_COLORS[s.trigger_type], border: `1px solid ${TRIGGER_COLORS[s.trigger_type]}30` }}>
                        {TRIGGER_LABELS[s.trigger_type]}
                      </span>
                      {s.expires_after_ms && (
                        <span style={{ fontSize: 9, color: "#64748b", display: "flex", alignItems: "center", gap: 3 }}>
                          <Clock size={9} /> expires {s.expires_after_ms >= 86400000 ? `${s.expires_after_ms / 86400000}d` : `${s.expires_after_ms / 3600000}h`}
                        </span>
                      )}
                    </div>
                    {s.description && <p style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.description}</p>}
                  </div>
                  <div style={{ display: "flex", gap: "0.2rem", flexShrink: 0 }}>
                    <button onClick={() => toggleActive(s)} title={s.active ? "Deactivate" : "Activate"} style={{ color: s.active ? "#f43f5e" : "#34d399", padding: "0.2rem", background: "none", border: "none", cursor: "pointer" }}>{s.active ? <X size={12} /> : <Check size={12} />}</button>
                    <button onClick={() => openEdit(s)} title="Edit" style={{ color: "#38bdf8", padding: "0.2rem", background: "none", border: "none", cursor: "pointer" }}><Edit2 size={12} /></button>
                    <button onClick={() => del(s.id)} title="Delete" style={{ color: "#f43f5e", padding: "0.2rem", background: "none", border: "none", cursor: "pointer" }}><Trash2 size={12} /></button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
    </div>
  );
}
