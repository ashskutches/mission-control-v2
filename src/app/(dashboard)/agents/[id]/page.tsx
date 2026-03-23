"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Bot, Pencil, Trash2, Hash, Target, Brain,
  ShieldAlert, Sparkles, Globe, FileText, BarChart2, Search,
  Layers, Palette, Mail, Zap, Image as ImageIcon, ChevronDown, ChevronUp, X,
  CheckCircle2, Loader2, AlignJustify,
} from "lucide-react";
import Link from "next/link";
import { AgentDocuments } from "@/components/AgentDocuments";
import { AgentRoutines } from "@/components/AgentRoutines";
import { AgentEmail } from "@/components/AgentEmail";
import { AgentDetailChat } from "@/components/AgentDetailChat";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

interface AgentDef {
  id: string; name: string; type: string; specialization: string;
  discordChannelId?: string; features: Record<string, boolean>;
  personality?: string; mission?: string; context?: string; constraints?: string;
  emoji?: string; color?: string; category?: string;
}

const ALL_FEATURES = [
  { id: "search",             label: "Web Search",         icon: Globe,       description: "Real-time web research via Tavily. Required for market research, competitor analysis, and SEO." },
  { id: "web_intelligence",   label: "Web Intelligence",   icon: BarChart2,   description: "Audit competitor websites for traffic data, Core Web Vitals, tech stack, and competitive signals." },
  { id: "memory",             label: "Long-term Memory",   icon: Brain,       description: "Remembers facts and past conversations across sessions via Supabase." },
  { id: "codebase_awareness", label: "Codebase Awareness", icon: Brain,       description: "Loads system architecture docs and skill guides. Use for dev/engineering agents." },
  { id: "shopify",            label: "Shopify",            icon: Bot,         description: "Live store data: orders, products, inventory, customers. Required for any e-commerce agent." },
  { id: "content_creation",   label: "Content Studio",     icon: Sparkles,    description: "Full content pipeline: copy, briefs, social posts, email campaigns. Loads content-intelligence, ecom-content, prompt-library, social-optimizer, email-campaign skills." },
  { id: "image_generation",   label: "Image Generation",   icon: ImageIcon,   description: "Multi-model image creation via Kie.ai — product shots, lifestyle imagery, backgrounds." },
  { id: "design_intelligence",label: "Prompt Enhancement", icon: Palette,     description: "Auto-enhances image prompts for HD quality using style presets. Requires Image Generation." },
  { id: "brand_enforcement",  label: "Brand-Aware Images", icon: Layers,      description: "Enforces L&R color rules and product references when generating images. Requires Image Generation." },
  { id: "business_context",   label: "Brand Guide",        icon: FileText,    description: "Injects brand context (mission, voice, products) into every conversation. Loads brand-identity and brand-voice skills." },
  { id: "seo_strategy",       label: "SEO Strategy",       icon: Search,      description: "Dual-mode SEO: article optimization with competitor research, or full site audit with HTML report." },
  { id: "gmail_read",         label: "Gmail Read",         icon: Mail,        description: "Read, search, and fetch full email content from the agent's connected Gmail inbox." },
  { id: "gmail_write",        label: "Gmail Write",        icon: Mail,        description: "Compose and send emails (including replies) from the agent's connected Gmail account." },
  { id: "google_workspace",   label: "Google Workspace",   icon: FileText,    description: "Create and share Google Docs/Sheets. Loads report-writer and content-library skills." },
  { id: "call",               label: "Voice Calls",        icon: Zap,         description: "Initiate outbound phone calls via Twilio with full conversation handling." },
  { id: "sms",                label: "SMS Messaging",      icon: Zap,         description: "Send, receive, and broadcast SMS messages via Twilio." },
  { id: "moderation",         label: "AI Moderation",      icon: ShieldAlert, description: "Auto-deletes harmful or policy-violating messages in Discord channels." },
];

// ── Skill tooltip wrapper ──────────────────────────────────────────────────────
function SkillTooltip({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  const [visible, setVisible] = React.useState(false);
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  if (!description) return <>{children}</>;
  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={e => { setVisible(true); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setPos({ x: r.left, y: r.bottom + 8 }); }}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span style={{
          position: "fixed", left: pos.x, top: pos.y, zIndex: 99999,
          background: "rgba(10,10,16,0.97)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10, padding: "8px 12px", maxWidth: 280, pointerEvents: "none",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}>
          <span style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#ff8c00", marginBottom: 3 }}>{label}</span>
          <span style={{ display: "block", fontSize: 11, color: "#aaa", lineHeight: 1.55 }}>{description}</span>
        </span>
      )}
    </span>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  "Design": "#ff6b9d", "Engineering": "#4da6ff", "Marketing": "#ff8c00",
  "Paid Media": "#a855f7", "Product": "#22c55e", "Project Management": "#06b6d4",
  "Testing": "#f59e0b", "Support": "#10b981", "Specialized": "#e879f9",
};

const PRIMING_FIELDS = [
  { id: "personality", label: "Personality & Tone",   icon: Sparkles,    placeholder: "e.g. Direct, no-nonsense." },
  { id: "mission",     label: "Primary Mission",       icon: Target,      placeholder: "e.g. Handle customer support." },
  { id: "context",     label: "Operational Context",   icon: Brain,       placeholder: "e.g. Deployed in #ecom-support." },
  { id: "constraints", label: "Constraints",           icon: ShieldAlert, placeholder: "e.g. NEVER share revenue figures." },
];

const EMOJI_PRESETS = ["🤖","🛡️","🎯","🔍","📊","🚨","⚙️","📦","💬","🔔","🗺️","🧠","🎨","📢","💰","🧪","🛟","📋"];

function EditModal({ agent, onSaved, onClose }: { agent: AgentDef; onSaved: () => void; onClose: () => void }) {
  const [form, setForm] = useState<Partial<AgentDef>>({ ...agent });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdv, setShowAdv] = useState(false);
  const set = (k: keyof AgentDef, v: any) => setForm(p => ({ ...p, [k]: v }));
  const toggleFeature = (id: string) => setForm(p => ({ ...p, features: { ...p.features, [id]: !p.features?.[id] } }));
  const inputStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, padding: "8px 12px", outline: "none", boxSizing: "border-box" };
  const catColors: Record<string, string> = { Intelligence: "#38bdf8", Commerce: "#f59e0b", Communication: "#7289da", Automation: "#a78bfa" };
  const featureCats = [
    { cat: "Intelligence", ids: ["search","web_intelligence","memory","codebase_awareness"] },
    { cat: "Commerce",     ids: ["shopify","content_creation","image_generation","design_intelligence","brand_enforcement","business_context","seo_strategy"] },
    { cat: "Communication",ids: ["gmail_read","gmail_write","google_workspace","call","sms"] },
    { cat: "Automation",   ids: ["moderation"] },
  ];
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const r = await fetch(`${BOT_URL}/admin/agents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: agent.id }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `Error ${r.status}`);
      onSaved(); onClose();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.94, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{ width: "min(580px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "#0e0e14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: "1.5rem", boxShadow: "0 40px 100px rgba(0,0,0,0.9)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ fontSize: 28 }}>{form.emoji ?? "🤖"}</span><div><p style={{ color: "#fff", fontWeight: 900, fontSize: 16, margin: 0 }}>Edit {agent.name}</p><p style={{ color: "#555", fontSize: 12, margin: 0 }}>{agent.id}</p></div></div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#666", cursor: "pointer", padding: "5px 7px", display: "flex" }}><X size={15} /></button>
        </div>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div><label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#555", marginBottom: 6 }}>Icon</label><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{EMOJI_PRESETS.map(e => (<button key={e} type="button" onClick={() => set("emoji", e)} style={{ fontSize: 18, padding: "4px 8px", borderRadius: 8, cursor: "pointer", background: form.emoji === e ? "rgba(255,140,0,0.2)" : "rgba(255,255,255,0.05)", border: form.emoji === e ? "1px solid rgba(255,140,0,0.5)" : "1px solid transparent" }}>{e}</button>))}</div></div>
          <div><label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#555", marginBottom: 4 }}>Name *</label><input required value={form.name ?? ""} onChange={e => set("name", e.target.value)} placeholder="Agent name" style={inputStyle} /></div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#555", marginBottom: 8 }}>Features</label>
            {featureCats.map(({ cat, ids }) => (
              <div key={cat} style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.07em", color: catColors[cat] ?? "#888", marginBottom: 5 }}>{cat}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {ids.map(id => {
                    const feat = ALL_FEATURES.find(f => f.id === id);
                    if (!feat) return null;
                    const Icon = feat.icon; const active = !!form.features?.[id]; const c = catColors[cat] ?? "#888";
                    return (
                      <SkillTooltip key={id} label={feat.label} description={feat.description}>
                        <button type="button" onClick={() => toggleFeature(id)} style={{ textAlign: "left", padding: "7px 10px", borderRadius: 8, background: active ? `${c}15` : "rgba(255,255,255,0.03)", border: `1px solid ${active ? c + "50" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
                          <Icon size={11} style={{ color: active ? c : "#555", flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: active ? "#fff" : "#666" }}>{feat.label}</span>
                          {active && <CheckCircle2 size={10} style={{ color: c, marginLeft: "auto" }} />}
                        </button>
                      </SkillTooltip>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div>
            <button type="button" onClick={() => setShowAdv(p => !p)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#555", fontSize: 13, padding: 0 }}>
              {showAdv ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Advanced Priming {showAdv ? "" : "(optional)"}
            </button>
            <AnimatePresence>{showAdv && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}><div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 12 }}>{PRIMING_FIELDS.map(f => { const Icon = f.icon; return (<div key={f.id}><div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><Icon size={11} color="#555" /><label style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>{f.label}</label></div><textarea rows={2} style={{ ...inputStyle, resize: "vertical" }} placeholder={f.placeholder} value={(form as any)[f.id] ?? ""} onChange={e => set(f.id as keyof AgentDef, e.target.value)} /></div>); })}</div></motion.div>)}</AnimatePresence>
          </div>
          {error && <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 18px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888", cursor: "pointer", fontSize: 13 }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: "8px 20px", borderRadius: 9, background: "rgba(255,140,0,0.15)", border: "1px solid rgba(255,140,0,0.35)", color: "#ff8c00", fontWeight: 800, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />Saving…</> : "Save Changes"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function Section({ title, icon, children, defaultOpen = true }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1rem", marginTop: "0.75rem" }}>
      <button onClick={() => setOpen(p => !p)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%", marginBottom: open ? 12 : 0 }}>
        <span style={{ color: "#555" }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.09em", color: "#888", flex: 1 }}>{title}</span>
        {open ? <ChevronUp size={11} color="#444" /> : <ChevronDown size={11} color="#444" />}
      </button>
      <AnimatePresence initial={false}>
        {open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>{children}</motion.div>}
      </AnimatePresence>
    </div>
  );
}

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params?.id as string;

  const [agent, setAgent] = useState<AgentDef | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const fetchAgent = useCallback(async () => {
    try {
      const r = await fetch(`${BOT_URL}/admin/agents`);
      const all: AgentDef[] = await r.json();
      const found = all.find(a => a.id === agentId);
      if (!found) { setNotFound(true); return; }
      setAgent(found);
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  }, [agentId]);

  useEffect(() => { fetchAgent(); }, [fetchAgent]);

  const handleDelete = async () => {
    if (!agent || !confirm(`Delete ${agent.name}? This cannot be undone.`)) return;
    await fetch(`${BOT_URL}/admin/agents/${agent.id}`, { method: "DELETE" });
    router.push("/agents");
  };

  const activeFeatures = agent ? ALL_FEATURES.filter(f => agent.features?.[f.id]) : [];
  const accentColor = agent?.color ?? CATEGORY_COLORS[agent?.category ?? ""] ?? "#38bdf8";

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#555" }}>
        <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 14 }}>Loading agent…</span>
      </div>
    </div>
  );

  if (notFound || !agent) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", textAlign: "center", opacity: 0.5 }}>
      <div><p style={{ fontSize: 48 }}>🤖</p><p style={{ color: "#ccc", fontWeight: 800, fontSize: 18 }}>Agent not found</p><Link href="/agents" style={{ color: "#ff8c00", fontSize: 13, textDecoration: "none" }}>← Back to Agents</Link></div>
    </div>
  );

  return (
    <div style={{ overflowY: "auto" }}>
      {/* ── Header ── */}
      <div style={{ padding: "1.5rem 1.5rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, background: "rgba(8,8,12,0.95)", backdropFilter: "blur(12px)", zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "0.875rem" }}>
          <button onClick={() => router.push("/agents")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, color: "#777", cursor: "pointer", padding: "5px 10px", fontSize: 12, fontWeight: 700 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#777"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}>
            <ArrowLeft size={13} /> All Agents
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `${accentColor}15`, border: `2px solid ${accentColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>{agent.emoji ?? "🤖"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 style={{ color: "#fff", fontWeight: 900, fontSize: 24, margin: 0 }}>{agent.name}</h1>
              {agent.category && <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: accentColor, background: `${accentColor}15`, border: `1px solid ${accentColor}35`, borderRadius: 6, padding: "2px 8px" }}>{agent.category}</span>}
              {activeFeatures.length > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: "#555", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "2px 8px" }}>{activeFeatures.length} features</span>}
            </div>
            <p style={{ color: "#666", fontSize: 13, margin: "3px 0 0" }}>{agent.specialization}</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button id={`edit-agent-${agent.id}`} onClick={() => setShowEdit(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,140,0,0.1)", border: "1px solid rgba(255,140,0,0.25)", borderRadius: 9, color: "#ff8c00", cursor: "pointer", padding: "7px 14px", fontSize: 13, fontWeight: 700 }}><Pencil size={13} /> Edit</button>
            <button onClick={handleDelete} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 9, color: "#ef4444", cursor: "pointer", padding: "7px 12px", fontSize: 13 }}><Trash2 size={13} /></button>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: "1.5rem", padding: "1.5rem", minHeight: "calc(100vh - 160px)", alignItems: "start" }}>

        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {agent.mission && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "1rem", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><Target size={12} color="#ff8c00" /><span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ff8c00" }}>Mission</span></div>
              <p style={{ color: "#bbb", fontSize: 13, lineHeight: 1.65, margin: 0 }}>{agent.mission}</p>
            </div>
          )}
          {agent.discordChannelId && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(114,137,218,0.06)", border: "1px solid rgba(114,137,218,0.15)", borderRadius: 9, marginBottom: "1rem" }}>
              <Hash size={12} color="#7289da" /><span style={{ color: "#7289da", fontSize: 12, fontWeight: 700 }}>#{agent.discordChannelId}</span>
            </div>
          )}
          {activeFeatures.length > 0 && (
            <Section title="Active Features" icon={<AlignJustify size={11} />}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {activeFeatures.map(f => { const Icon = f.icon; return (
                  <SkillTooltip key={f.id} label={f.label} description={f.description}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,140,0,0.08)", border: "1px solid rgba(255,140,0,0.22)", borderRadius: 8, color: "#ff8c00", fontSize: 11, fontWeight: 700, padding: "3px 9px", cursor: "default" }}>
                      <Icon size={10} /> {f.label}
                    </span>
                  </SkillTooltip>
                ); })}
              </div>
            </Section>
          )}
          <Section title="Document Library" icon={<FileText size={11} />}><AgentDocuments agentId={agent.id} /></Section>
          <Section title="Routines" icon={<AlignJustify size={11} />} defaultOpen={false}><AgentRoutines agentId={agent.id} agentName={agent.name} /></Section>
          <Section title="Integrations" icon={<Zap size={11} />} defaultOpen={false}><AgentEmail agentId={agent.id} agentName={agent.name} /></Section>
          {(agent.personality || agent.context || agent.constraints) && (
            <Section title="Priming Details" icon={<Brain size={11} />} defaultOpen={false}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {agent.personality && <div><p style={{ fontSize: 10, fontWeight: 800, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 3px" }}>Personality</p><p style={{ color: "#888", fontSize: 12, lineHeight: 1.6, margin: 0 }}>{agent.personality}</p></div>}
                {agent.context && <div><p style={{ fontSize: 10, fontWeight: 800, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 3px" }}>Context</p><p style={{ color: "#888", fontSize: 12, lineHeight: 1.6, margin: 0 }}>{agent.context}</p></div>}
                {agent.constraints && <div><p style={{ fontSize: 10, fontWeight: 800, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 3px" }}>Constraints</p><p style={{ color: "#888", fontSize: 12, lineHeight: 1.6, margin: 0 }}>{agent.constraints}</p></div>}
              </div>
            </Section>
          )}
        </div>

        {/* RIGHT: Chat */}
        <div style={{ position: "sticky", top: "140px", height: "calc(100vh - 200px)" }}>
          <AgentDetailChat agentId={agent.id} agentName={agent.name} agentEmoji={agent.emoji} agentColor={accentColor} />
        </div>
      </div>

      <AnimatePresence>
        {showEdit && <EditModal agent={agent} onSaved={fetchAgent} onClose={() => setShowEdit(false)} />}
      </AnimatePresence>
    </div>
  );
}
