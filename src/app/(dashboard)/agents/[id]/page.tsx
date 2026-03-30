"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Pencil, Trash2, Hash, Target, Brain,
  ShieldAlert, Sparkles, FileText, ChevronDown, ChevronUp, X,
  Loader2, CheckCircle2, AlignJustify, Zap,
} from "lucide-react";
import Link from "next/link";
import { AgentDocuments } from "@/components/AgentDocuments";
import { AgentRoutines } from "@/components/AgentRoutines";
import { AgentEmail } from "@/components/AgentEmail";
import { AgentDetailChat } from "@/components/AgentDetailChat";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

interface AgentDef {
  id: string; name: string; type: string; specialization: string;
  discordChannelId?: string; discordManagerId?: string;
  role?: string;
  action_perms?: { email?: boolean; sms?: boolean; social?: boolean; calls?: boolean };
  personality?: string; mission?: string; context?: string; constraints?: string;
  emoji?: string; color?: string; category?: string;
}

interface DiscordMember {
  id: string; username: string; displayName: string; avatar: string;
}



const CATEGORY_COLORS: Record<string, string> = {
  "Design": "#ff6b9d", "Engineering": "#4da6ff", "Marketing": "#ff8c00",
  "Paid Media": "#a855f7", "Product": "#22c55e", "Project Management": "#06b6d4",
  "Testing": "#f59e0b", "Support": "#10b981", "Specialized": "#e879f9",
  "Influencing": "#f43f5e", "Organics": "#84cc16", "General": "#6366f1",
};

const CATEGORY_EMOJI: Record<string, string> = {
  "Design": "🎨", "Engineering": "⚙️", "Marketing": "📢",
  "Paid Media": "💰", "Product": "📦", "Project Management": "📋",
  "Testing": "🧪", "Support": "🛀", "Specialized": "🎯",
  "Influencing": "🌟", "Organics": "🌱", "General": "🤖",
};

const ROLE_PRESETS: { id: string; label: string; emoji: string }[] = [
  { id: "general",           label: "General Assistant",        emoji: "🤖" },
  { id: "lead-agent",        label: "Lead Agent / Dept Head",    emoji: "🧠" },
  { id: "seo-analyst",       label: "SEO Analyst",               emoji: "🔍" },
  { id: "email-marketer",    label: "Email Marketer",            emoji: "📧" },
  { id: "content-creator",   label: "Content Creator",          emoji: "🎨" },
  { id: "influencing-agent", label: "Influencer / Social",      emoji: "⭐" },
  { id: "support-agent",     label: "Customer Support",         emoji: "🛟" },
  { id: "ads-manager",       label: "Paid Ads Manager",         emoji: "📢" },
  { id: "analytics-agent",   label: "Analytics & Commerce",     emoji: "📊" },
];

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
  const toggleActionPerm = (perm: keyof NonNullable<AgentDef["action_perms"]>) =>
    setForm(p => ({ ...p, action_perms: { ...(p.action_perms ?? {}), [perm]: !(p.action_perms?.[perm]) } }));
  const inputStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, padding: "8px 12px", outline: "none", boxSizing: "border-box" };

  // Discord member roster for manager dropdown
  const [discordMembers, setDiscordMembers] = useState<DiscordMember[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  useEffect(() => {
    fetch(`${BOT_URL}/admin/agents/discord-members`)
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setDiscordMembers(data) : [])
      .catch(() => {});
  }, []);
  const filteredMembers = discordMembers.filter(m =>
    m.displayName.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.username.toLowerCase().includes(memberSearch.toLowerCase())
  );
  const selectedMember = discordMembers.find(m => m.username === form.discordManagerId || m.id === form.discordManagerId);
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
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#555", marginBottom: 4 }}>Department</label>
            <select
              value={form.category ?? ""}
              onChange={e => set("category", e.target.value || undefined)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="">— Auto-detect from specialization</option>
              {Object.keys(CATEGORY_COLORS).map(cat => (
                <option key={cat} value={cat}>{CATEGORY_EMOJI[cat]} {cat}</option>
              ))}
            </select>
            <p style={{ fontSize: 10, color: "#555", margin: "4px 0 0" }}>Sets which group this agent appears under on the roster</p>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#555", marginBottom: 4 }}>Discord Channel ID</label>
            <div style={{ position: "relative" }}>
              <Hash size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#7289da", pointerEvents: "none" }} />
              <input
                value={form.discordChannelId ?? ""}
                onChange={e => set("discordChannelId", e.target.value)}
                placeholder="e.g. 1234567890123456789"
                style={{ ...inputStyle, paddingLeft: 28 }}
              />
            </div>
            <p style={{ fontSize: 10, color: "#555", margin: "4px 0 0" }}>Right-click any Discord channel → Copy Channel ID (requires Developer Mode)</p>
          </div>
          <div style={{ position: "relative" }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#555", marginBottom: 4 }}>Discord Manager / Owner</label>
            {discordMembers.length > 0 ? (
              <div style={{ position: "relative" }}>
                {/* Trigger button */}
                <button
                  type="button"
                  onClick={() => { setDropdownOpen(p => !p); setMemberSearch(""); }}
                  style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left" }}
                >
                  {selectedMember ? (
                    <>
                      <img src={selectedMember.avatar} alt="" style={{ width: 18, height: 18, borderRadius: "50%" }} />
                      <span style={{ flex: 1 }}>{selectedMember.displayName}</span>
                      <span style={{ color: "#555", fontSize: 11 }}>@{selectedMember.username}</span>
                    </>
                  ) : (
                    <span style={{ color: "#555" }}>Select a Discord member…</span>
                  )}
                  <ChevronDown size={13} style={{ color: "#555", marginLeft: "auto", flexShrink: 0 }} />
                </button>
                {/* Dropdown */}
                {dropdownOpen && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10000,
                    background: "#0e0e14", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10, overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,0.8)",
                  }}>
                    <div style={{ padding: "8px 8px 4px" }}>
                      <input
                        autoFocus
                        placeholder="Search members…"
                        value={memberSearch}
                        onChange={e => setMemberSearch(e.target.value)}
                        style={{ ...inputStyle, fontSize: 12, padding: "6px 10px" }}
                      />
                    </div>
                    <div style={{ maxHeight: 200, overflowY: "auto" }}>
                      <button
                        type="button"
                        onClick={() => { set("discordManagerId", ""); setDropdownOpen(false); }}
                        style={{ width: "100%", padding: "8px 12px", textAlign: "left", background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 12 }}
                      >
                        — None
                      </button>
                      {filteredMembers.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { set("discordManagerId", m.username); setDropdownOpen(false); }}
                          style={{
                            width: "100%", padding: "7px 12px", textAlign: "left",
                            background: form.discordManagerId === m.username ? "rgba(255,140,0,0.12)" : "none",
                            border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                          onMouseLeave={e => (e.currentTarget.style.background = form.discordManagerId === m.username ? "rgba(255,140,0,0.12)" : "none")}
                        >
                          <img src={m.avatar} alt="" style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: "#e5e5e5", fontWeight: 700, fontSize: 12, margin: 0 }}>{m.displayName}</p>
                            <p style={{ color: "#555", fontSize: 10, margin: 0 }}>@{m.username}</p>
                          </div>
                          {form.discordManagerId === m.username && <CheckCircle2 size={13} style={{ color: "#ff8c00", flexShrink: 0 }} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Fallback: plain text if Discord members couldn't be fetched
              <input
                value={form.discordManagerId ?? ""}
                onChange={e => set("discordManagerId", e.target.value)}
                placeholder="e.g. robert (Discord username)"
                style={inputStyle}
              />
            )}
            <p style={{ fontSize: 10, color: "#555", margin: "4px 0 0" }}>Agent will discord_dm this person for escalations or when clarification is needed</p>
          </div>
          {/* Role */}
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#555", marginBottom: 4 }}>Role</label>
            <select value={form.role ?? "general"} onChange={e => set("role", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {ROLE_PRESETS.map(r => <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>)}
            </select>
            <p style={{ fontSize: 10, color: "#555", margin: "4px 0 0" }}>Hint to backend for skill inference — tools auto-selected per task</p>
          </div>
          {/* Action Permissions */}
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#555", marginBottom: 4 }}>Action Permissions</label>
            <p style={{ fontSize: 10, color: "#555", margin: "0 0 8px" }}>Live-fire actions — off by default, explicit grant required.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {([{key:"email",label:"📧 Email",desc:"gmail_send"},{key:"sms",label:"📱 SMS",desc:"Twilio SMS"},{key:"social",label:"📢 Social",desc:"Publish posts"},{key:"calls",label:"📞 Calls",desc:"Outbound calls"}] as const).map(({key,label,desc}) => {
                const active = !!(form.action_perms?.[key]);
                return (
                  <button key={key} type="button" onClick={() => toggleActionPerm(key)} style={{ textAlign:"left", padding:"9px 11px", borderRadius:9, background: active ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.02)", border: active ? "1px solid rgba(239,68,68,0.35)" : "1px solid rgba(255,255,255,0.07)", cursor:"pointer", transition:"all 0.15s" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:2 }}>
                      <span style={{ width:7, height:7, borderRadius:"50%", background: active ? "#ef4444" : "#444", flexShrink:0 }} />
                      <span style={{ fontSize:11, fontWeight:800, color: active ? "#fff" : "#666" }}>{label}</span>
                    </div>
                    <p style={{ fontSize:9, color:"#555", margin:0, paddingLeft:14 }}>{desc}</p>
                  </button>
                );
              })}
            </div>
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

function Section({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "0.5rem" }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
          width: "100%", padding: "0.65rem 0.75rem", borderRadius: 8,
          background: open ? "rgba(255,140,0,0.06)" : "transparent",
          transition: "background 0.15s",
          marginBottom: open ? 6 : 0,
          boxSizing: "border-box",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = open ? "rgba(255,140,0,0.08)" : "rgba(255,255,255,0.04)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = open ? "rgba(255,140,0,0.06)" : "transparent"; }}
      >
        <span style={{ color: open ? "#ff8c00" : "#555", transition: "color 0.15s" }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.09em", color: open ? "#cc6e00" : "#666", flex: 1, transition: "color 0.15s" }}>{title}</span>
        {open ? <ChevronUp size={11} color="#ff8c00" /> : <ChevronDown size={11} color="#444" />}
      </button>
      <AnimatePresence initial={false}>
        {open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", paddingLeft: "0.5rem", paddingRight: "0.5rem" }}>{children}</motion.div>}
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
    <div style={{ overflowY: "auto", overflowX: "hidden", minWidth: 0 }}>
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
              {agent.role && <span style={{ fontSize: 10, fontWeight: 700, color: "#555", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "2px 8px" }}>{agent.role}</span>}
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
      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: "1.5rem", padding: "1.5rem", minHeight: "calc(100vh - 160px)", alignItems: "start", minWidth: 0, overflow: "hidden" }}>

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
          {agent.action_perms && Object.values(agent.action_perms).some(Boolean) && (
            <Section title="Action Permissions" icon={<ShieldAlert size={11} />} defaultOpen={true}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "4px 0" }}>
                {agent.action_perms.email  && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}>📧 Email</span>}
                {agent.action_perms.sms    && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b" }}>📱 SMS</span>}
                {agent.action_perms.social && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.3)", color: "#a855f7" }}>📢 Social</span>}
                {agent.action_perms.calls  && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}>📞 Calls</span>}
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
        <div style={{ position: "sticky", top: "140px", height: "calc(100vh - 200px)", minWidth: 0, overflow: "hidden" }}>
          <AgentDetailChat agentId={agent.id} agentName={agent.name} agentEmoji={agent.emoji} agentColor={accentColor} />
        </div>
      </div>

      <AnimatePresence>
        {showEdit && <EditModal agent={agent} onSaved={fetchAgent} onClose={() => setShowEdit(false)} />}
      </AnimatePresence>
    </div>
  );
}
