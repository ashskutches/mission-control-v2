"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Users, RefreshCw, Plus, Pencil, Trash2, X, Check,
  MapPin, Mail, Clock, Briefcase, Loader, AlertCircle,
  Shield, ChevronDown, ChevronUp, Sparkles, MessageSquare,
  Play, ExternalLink, AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SectionAgentPanel from "@/components/SectionAgentPanel";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";

const TEAM_SECTION_HINT = `You are the Lead Agent for the **Team** domain (section ID: "team").

Your primary mission when triggered with a populate request:
1. Call get_team_members (active_only: false) to get ALL team members with their IDs
2. For each member, research who they are based on their username, display_name, Discord presence, and any context available
3. Call update_team_member for each person to enrich their profile:
   - bio: 2–3 sentences about who they are and their background
   - role: their role at Leaps & Rebounds (owner/founder/marketing/ops/contractor)
   - areas: an array of responsibility areas (e.g. ['marketing', 'email', 'customer_success'])
   - current_focus: a sentence about what they're currently working on
   - timezone: best guess based on their location if known
4. After enriching all members, call log_insight to summarise the team composition

For context: Leaps & Rebounds (leapsandrebounds.ai) is a DTC ecommerce brand selling rebounders/trampolines. The team is small (founder-led) and uses AI agents for most operational work.

Be thoughtful and specific — generic placeholder bios are not acceptable. If you cannot determine something with confidence, leave that field unchanged (don't pass it) rather than guessing wildly.`.trim();

interface TeamMember {
  id: string;
  discord_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  role: string | null;
  areas: string[] | null;
  timezone: string | null;
  active: boolean;
  bio: string | null;
  current_focus: string | null;
  active_work_count: number;
  active_task_count: number;
  last_synced_at: string | null;
  created_at: string;
}

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  owner:            { color: "#e98d20", bg: "rgba(233,141,32,0.12)" },
  founder:          { color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  marketing:        { color: "#38bdf8", bg: "rgba(56,189,248,0.10)" },
  seo:              { color: "#22d3ee", bg: "rgba(34,211,238,0.10)" },
  ops:              { color: "#22c55e", bg: "rgba(34,197,94,0.10)" },
  engineer:         { color: "#818cf8", bg: "rgba(129,140,248,0.10)" },
  designer:         { color: "#f472b6", bg: "rgba(244,114,182,0.10)" },
  product:          { color: "#fb923c", bg: "rgba(251,146,60,0.10)" },
  customer_success: { color: "#34d399", bg: "rgba(52,211,153,0.10)" },
  sales:            { color: "#facc15", bg: "rgba(250,204,21,0.10)" },
  finance:          { color: "#4ade80", bg: "rgba(74,222,128,0.10)" },
  hr:               { color: "#e879f9", bg: "rgba(232,121,249,0.10)" },
  content:          { color: "#f87171", bg: "rgba(248,113,113,0.10)" },
  advisor:          { color: "#cbd5e1", bg: "rgba(203,213,225,0.08)" },
  agency:           { color: "#7dd3fc", bg: "rgba(125,211,252,0.10)" },
  contractor:       { color: "#94a3b8", bg: "rgba(148,163,184,0.08)" },
};

function getRoleStyle(role: string | null) {
  return role
    ? (ROLE_COLORS[role.toLowerCase()] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.08)" })
    : { color: "#475569", bg: "rgba(255,255,255,0.04)" };
}

// ── Add/Edit Modal ────────────────────────────────────────────────────────────
function MemberModal({
  member,
  onClose,
  onSave,
}: {
  member: TeamMember | null; // null = add new
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const isEdit = !!member;
  const [form, setForm] = useState({
    discord_id: member?.discord_id ?? "",
    username: member?.username ?? "",
    display_name: member?.display_name ?? "",
    role: member?.role ?? "",
    areas: (member?.areas ?? []).join(", "),
    email: member?.email ?? "",
    timezone: member?.timezone ?? "America/New_York",
    bio: member?.bio ?? "",
    current_focus: member?.current_focus ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...form,
        areas: form.areas.split(",").map(s => s.trim()).filter(Boolean),
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, color: "#e2e8f0", fontSize: "0.875rem",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em",
    textTransform: "uppercase", color: "#64748b", marginBottom: 4, display: "block",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        style={{
          width: "100%", maxWidth: 560,
          background: "rgba(13,17,27,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16, padding: "1.5rem",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 style={{ fontWeight: 800, fontSize: "1.1rem", color: "#e2e8f0" }}>
            {isEdit ? `Edit ${member?.display_name ?? member?.username}` : "Add Team Member"}
          </h2>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569" }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {!isEdit && (
              <div style={{ gridColumn: "1/-1" }}>
                <label style={labelStyle}>Discord ID *</label>
                <input
                  id="tm-discord-id"
                  style={inputStyle}
                  value={form.discord_id}
                  onChange={set("discord_id")}
                  placeholder="e.g. 123456789012345678"
                  required
                />
              </div>
            )}
            <div>
              <label style={labelStyle}>Username *</label>
              <input
                id="tm-username"
                style={inputStyle}
                value={form.username}
                onChange={set("username")}
                placeholder="ashskutches"
                required={!isEdit}
              />
            </div>
            <div>
              <label style={labelStyle}>Display Name</label>
              <input
                id="tm-display-name"
                style={inputStyle}
                value={form.display_name}
                onChange={set("display_name")}
                placeholder="Ash Skutches"
              />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select id="tm-role" style={inputStyle} value={form.role} onChange={set("role")}>
                <option value="">— Select role —</option>
                <optgroup label="Leadership">
                  <option value="owner">Owner</option>
                  <option value="founder">Founder</option>
                  <option value="advisor">Advisor</option>
                </optgroup>
                <optgroup label="Marketing & Growth">
                  <option value="marketing">Marketing</option>
                  <option value="seo">SEO</option>
                  <option value="content">Content Creator</option>
                  <option value="sales">Sales</option>
                </optgroup>
                <optgroup label="Product & Tech">
                  <option value="product">Product</option>
                  <option value="engineer">Engineer / Dev</option>
                  <option value="designer">Designer</option>
                </optgroup>
                <optgroup label="Operations">
                  <option value="ops">Ops</option>
                  <option value="finance">Finance / Accounting</option>
                  <option value="hr">HR / People Ops</option>
                  <option value="customer_success">Customer Success</option>
                </optgroup>
                <optgroup label="External">
                  <option value="contractor">Contractor</option>
                  <option value="agency">Agency / Partner</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Timezone</label>
              <input
                id="tm-timezone"
                style={inputStyle}
                value={form.timezone}
                onChange={set("timezone")}
                placeholder="America/New_York"
              />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={labelStyle}>Areas (comma-separated)</label>
              <input
                id="tm-areas"
                style={inputStyle}
                value={form.areas}
                onChange={set("areas")}
                placeholder="marketing, design, customer_success"
              />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={labelStyle}>Email</label>
              <input
                id="tm-email"
                type="email"
                style={inputStyle}
                value={form.email}
                onChange={set("email")}
                placeholder="ash@leapsandrebounds.com"
              />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={labelStyle}>Current Focus</label>
              <input
                id="tm-focus"
                style={inputStyle}
                value={form.current_focus}
                onChange={set("current_focus")}
                placeholder="Working on Q3 email flows…"
              />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={labelStyle}>Bio</label>
              <textarea
                id="tm-bio"
                style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                value={form.bio}
                onChange={set("bio")}
                placeholder="Brief description of this person's role and expertise…"
              />
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: "0.75rem", padding: "8px 12px", borderRadius: 8,
              background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)",
              display: "flex", gap: 8, alignItems: "center", color: "#f43f5e", fontSize: "0.85rem",
            }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
            <button
              type="button"
              onClick={onClose}
              className="button is-ghost"
              style={{ color: "#475569", fontSize: "0.875rem" }}
            >
              Cancel
            </button>
            <motion.button
              type="submit"
              disabled={saving}
              whileHover={!saving ? { scale: 1.02 } : {}}
              whileTap={!saving ? { scale: 0.98 } : {}}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 20px", borderRadius: 8, fontWeight: 700, fontSize: "0.875rem",
                background: "linear-gradient(135deg, #a78bfa, #818cf8)",
                color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? <Loader size={14} className="spin" /> : <Check size={14} />}
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Member"}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Member Card ───────────────────────────────────────────────────────────────
function MemberCard({
  member,
  onEdit,
  onDelete,
}: {
  member: TeamMember;
  onEdit: (m: TeamMember) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const roleStyle = getRoleStyle(member.role);
  const name = member.display_name ?? member.username;
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14,
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}
      whileHover={{ borderColor: "rgba(167,139,250,0.2)" }}
    >
      {/* Card header */}
      <div style={{ padding: "1rem 1rem 0.75rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            {member.avatar_url ? (
              <img
                src={member.avatar_url}
                alt={name}
                style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", border: "2px solid rgba(255,255,255,0.08)" }}
              />
            ) : (
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: "linear-gradient(135deg, rgba(167,139,250,0.3), rgba(129,140,248,0.2))",
                border: "2px solid rgba(167,139,250,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: "1rem", color: "#a78bfa",
                fontFamily: "'Montserrat', sans-serif",
              }}>
                {initials}
              </div>
            )}
            {/* Active dot */}
            <div style={{
              position: "absolute", bottom: 0, right: 0,
              width: 10, height: 10, borderRadius: "50%",
              background: member.active ? "#22c55e" : "#475569",
              border: "2px solid rgba(10,15,25,1)",
            }} />
          </div>

          {/* Name + role */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#e2e8f0" }}>{name}</span>
              {member.role && (
                <span style={{
                  fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                  padding: "2px 8px", borderRadius: 10,
                  color: roleStyle.color, background: roleStyle.bg,
                  border: `1px solid ${roleStyle.color}30`,
                }}>
                  {member.role}
                </span>
              )}
            </div>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 2 }}>@{member.username}</p>

            {/* Stats row */}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
              {member.timezone && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "11px", color: "#475569" }}>
                  <MapPin size={10} /> {member.timezone.replace("America/", "").replace(/_/g, " ")}
                </span>
              )}
              {member.email && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "11px", color: "#475569" }}>
                  <Mail size={10} /> {member.email}
                </span>
              )}
              {(member.active_work_count > 0 || member.active_task_count > 0) && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "11px", color: "#a78bfa" }}>
                  <Briefcase size={10} />
                  {member.active_work_count} work · {member.active_task_count} tasks
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0 }}>
            <motion.button
              onClick={() => onEdit(member)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              aria-label={`Edit ${name}`}
              style={{
                width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b",
              }}
            >
              <Pencil size={13} />
            </motion.button>
            <motion.button
              onClick={() => setConfirmDelete(!confirmDelete)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              aria-label={`Delete ${name}`}
              style={{
                width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(244,63,94,0.15)",
                background: confirmDelete ? "rgba(244,63,94,0.1)" : "rgba(255,255,255,0.04)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: confirmDelete ? "#f43f5e" : "#475569",
              }}
            >
              {confirmDelete ? <AlertCircle size={13} /> : <Trash2 size={13} />}
            </motion.button>
          </div>
        </div>

        {/* Areas */}
        {member.areas && member.areas.length > 0 && (
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            {member.areas.map(area => (
              <span key={area} style={{
                fontSize: "10px", padding: "2px 8px", borderRadius: 8,
                background: "rgba(255,255,255,0.05)", color: "#64748b",
                border: "1px solid rgba(255,255,255,0.07)",
              }}>
                {area}
              </span>
            ))}
          </div>
        )}

        {/* Confirm delete */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: "hidden" }}
            >
              <div style={{
                marginTop: "0.75rem", padding: "8px 12px", borderRadius: 8,
                background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.18)",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem",
              }}>
                <span style={{ fontSize: "0.82rem", color: "#fca5a5" }}>Remove {name} from team?</span>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="button is-small is-ghost"
                    style={{ fontSize: "11px", color: "#64748b" }}
                  >
                    Cancel
                  </button>
                  <motion.button
                    onClick={() => onDelete(member.id)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      padding: "3px 10px", borderRadius: 6, fontSize: "11px", fontWeight: 700,
                      background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)",
                      color: "#f43f5e", cursor: "pointer",
                    }}
                  >
                    Delete
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Expandable bio/focus */}
      {(member.bio || member.current_focus) && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              width: "100%", padding: "0.4rem 1rem",
              background: "rgba(255,255,255,0.02)", border: "none",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
              color: "#475569", fontSize: "10px",
            }}
          >
            <span style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
              {expanded ? "Hide details" : "Show details"}
            </span>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: "hidden" }}
              >
                <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                  {member.current_focus && (
                    <div style={{ marginBottom: member.bio ? "0.5rem" : 0 }}>
                      <span style={{ fontSize: "9px", fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Current Focus
                      </span>
                      <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: 2 }}>{member.current_focus}</p>
                    </div>
                  )}
                  {member.bio && (
                    <div>
                      <span style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Bio
                      </span>
                      <p style={{ fontSize: "0.82rem", color: "#64748b", marginTop: 2 }}>{member.bio}</p>
                    </div>
                  )}
                  {member.last_synced_at && (
                    <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={9} color="#334155" />
                      <span style={{ fontSize: "9px", color: "#334155" }}>
                        Synced {new Date(member.last_synced_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [assignedAgent, setAssignedAgent] = useState<{ id: string; name: string; emoji?: string; color?: string } | null>(null);

  // Populate-data run state
  const [populating, setPopulating] = useState(false);
  const [popStage, setPopStage] = useState<"idle" | "creating" | "working" | "done" | "error">("idle");
  const [popMsg, setPopMsg] = useState<string | null>(null);
  const [popConvId, setPopConvId] = useState<string | null>(null);
  const [popElapsed, setPopElapsed] = useState(0);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/team`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members ?? []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const syncFromDiscord = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/team/sync`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncMsg({ text: `✅ Synced ${data.synced} member(s) from Discord`, ok: true });
        fetchMembers();
      } else {
        setSyncMsg({ text: `❌ ${data.error ?? "Sync failed"}`, ok: false });
      }
    } catch (err: any) {
      setSyncMsg({ text: `❌ ${err.message}`, ok: false });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 5000);
    }
  };

  const populateData = async () => {
    if (!assignedAgent || populating) return;
    setPopulating(true);
    setPopStage("creating");
    setPopMsg(null);
    setPopConvId(null);
    setPopElapsed(0);

    const timerRef = setInterval(() => setPopElapsed(s => s + 1), 1000);

    try {
      // Step 1: Create conversation
      const convRes = await fetch(`${BOT_URL}/admin/chat/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: assignedAgent.id,
          title: `Team Profile Population — ${new Date().toLocaleDateString()}`,
        }),
      });
      if (!convRes.ok) throw new Error(`Failed to create conversation: ${await convRes.text()}`);
      const conv = await convRes.json();
      setPopConvId(conv.id);

      // Step 2: Send the populate prompt
      setPopStage("working");
      const POPULATE_PROMPT = `You are being asked to populate and enrich team member profiles for Leaps & Rebounds.

Please do the following:
1. Call get_team_members with active_only: false to get ALL team members and their IDs
2. For EACH team member returned:
   - Review their username and display_name for context
   - Construct an appropriate bio, role, areas, and current_focus based on what you know about the company and who they likely are
   - Call update_team_member with the member_id and the fields you are confident about
   - Only set fields you have reasonable confidence in — leave unknowns unset rather than fabricating
3. After updating all members, provide a summary of what you updated for each person

The company is Leaps & Rebounds (leapsandrebounds.ai) — a DTC ecommerce brand selling rebounders/trampolines for fitness. The team is small and founder-led.

Begin immediately — call get_team_members first, then work through each member.`;

      const msgRes = await fetch(`${BOT_URL}/admin/chat/conversations/${conv.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: POPULATE_PROMPT }),
        signal: AbortSignal.timeout(300_000), // 5 min max for iterating through all members
      });
      if (!msgRes.ok) throw new Error(`Agent call failed: ${await msgRes.text()}`);

      setPopStage("done");
      fetchMembers(); // Refresh member cards after population
    } catch (err: any) {
      const msg = err?.name === "TimeoutError" ? "Agent timed out after 5 minutes" : err.message;
      setPopMsg(msg);
      setPopStage("error");
    } finally {
      clearInterval(timerRef);
      setPopulating(false);
    }
  };

  const openAdd = () => { setEditingMember(null); setShowModal(true); };
  const openEdit = (m: TeamMember) => { setEditingMember(m); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingMember(null); };

  const saveMember = async (data: any) => {
    if (editingMember) {
      const res = await fetch(`${BOT_URL}/admin/team/${editingMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Update failed");
    } else {
      const res = await fetch(`${BOT_URL}/admin/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Create failed");
    }
    await fetchMembers();
  };

  const deleteMember = async (id: string) => {
    try {
      await fetch(`${BOT_URL}/admin/team/${id}`, { method: "DELETE" });
      setMembers(prev => prev.filter(m => m.id !== id));
    } catch { /* silent */ }
  };

  const activeMembers = members.filter(m => m.active);
  const inactiveMembers = members.filter(m => !m.active);

  const accentColor = (assignedAgent as any)?.color ?? "#a78bfa";

  return (
    <>
      <div className="px-5 py-5" style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div className="mb-4" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: 4 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "linear-gradient(135deg, rgba(167,139,250,0.25), rgba(129,140,248,0.15))",
                border: "1px solid rgba(167,139,250,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Users size={20} color="#a78bfa" />
              </div>
              <h1 style={{ fontWeight: 800, fontSize: "1.5rem", color: "#e2e8f0", margin: 0 }}>Team</h1>
              <span style={{
                fontSize: "11px", fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa",
              }}>
                {activeMembers.length} active
              </span>
            </div>
            <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
              Company roster — synced from Discord, enriched by agents.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <motion.button
              onClick={syncFromDiscord}
              disabled={syncing}
              whileHover={!syncing ? { scale: 1.02 } : {}}
              whileTap={!syncing ? { scale: 0.98 } : {}}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
                borderRadius: 8, fontWeight: 700, fontSize: "0.875rem",
                background: syncing ? "rgba(56,189,248,0.06)" : "rgba(56,189,248,0.12)",
                border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8",
                cursor: syncing ? "not-allowed" : "pointer",
              }}
            >
              {syncing ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />}
              {syncing ? "Syncing…" : "Sync from Discord"}
            </motion.button>
            <motion.button
              onClick={openAdd}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
                borderRadius: 8, fontWeight: 700, fontSize: "0.875rem",
                background: "linear-gradient(135deg, rgba(167,139,250,0.2), rgba(129,140,248,0.15))",
                border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa", cursor: "pointer",
              }}
            >
              <Plus size={14} /> Add Member
            </motion.button>
          </div>
        </div>

        {/* Agent Panel */}
        <SectionAgentPanel
          sectionId="team"
          sectionName="Team"
          sectionHint={TEAM_SECTION_HINT}
          accentColor="#a78bfa"
          onAgentAssigned={a => setAssignedAgent(a)}
        />

        {/* Populate Data button — only shown when an agent is assigned */}
        <AnimatePresence>
          {assignedAgent && (
            <motion.div
              key="populate-bar"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{
                marginBottom: "1.25rem",
                padding: "0.875rem 1.25rem",
                borderRadius: 12,
                background: `${accentColor}07`,
                border: `1px solid ${accentColor}20`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexWrap: "wrap", gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${accentColor}15`, border: `1px solid ${accentColor}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.1rem",
                }}>
                  {assignedAgent.emoji ?? "🤖"}
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "#e2e8f0", margin: 0, lineHeight: 1 }}>
                    Populate Team Profiles
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748b", margin: "3px 0 0" }}>
                    {assignedAgent.name} will enrich bios, roles, areas & focus for all members
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {/* Status row */}
                {popStage === "working" && (
                  <span style={{ fontSize: "11px", color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                    <Loader size={11} className="spin" />
                    Enriching profiles… <span style={{ color: accentColor, fontWeight: 700 }}>{popElapsed}s</span>
                    {popConvId && (
                      <a href={`/chats?conversation=${popConvId}`} style={{ color: accentColor, display: "flex", alignItems: "center", gap: 2, marginLeft: 6, fontWeight: 700 }}>
                        <MessageSquare size={11} /> Watch live
                      </a>
                    )}
                  </span>
                )}
                {popStage === "done" && (
                  <span style={{ fontSize: "11px", color: "#22c55e", display: "flex", alignItems: "center", gap: 4 }}>
                    <Check size={12} /> Done in {popElapsed}s
                    {popConvId && (
                      <a href={`/chats?conversation=${popConvId}`} style={{ color: "#64748b", display: "flex", alignItems: "center", gap: 2, marginLeft: 6 }}>
                        <MessageSquare size={11} /> View chat
                      </a>
                    )}
                  </span>
                )}
                {popStage === "error" && (
                  <span style={{ fontSize: "11px", color: "#f43f5e", display: "flex", alignItems: "center", gap: 4 }}>
                    <AlertTriangle size={11} /> {popMsg ?? "Failed"}
                    {popConvId && (
                      <a href={`/chats?conversation=${popConvId}`} style={{ color: "#64748b", display: "flex", alignItems: "center", gap: 2, marginLeft: 6 }}>
                        <MessageSquare size={11} /> Debug
                      </a>
                    )}
                  </span>
                )}
                <motion.button
                  id="populate-data-btn"
                  onClick={populateData}
                  disabled={populating}
                  whileHover={!populating ? { scale: 1.03 } : {}}
                  whileTap={!populating ? { scale: 0.97 } : {}}
                  aria-label="Populate team profiles using AI agent"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 18px", borderRadius: 8, fontWeight: 700, fontSize: "0.8rem",
                    background: populating
                      ? `${accentColor}08`
                      : `linear-gradient(135deg, ${accentColor}25, ${accentColor}15)`,
                    border: `1px solid ${accentColor}${populating ? "18" : "40"}`,
                    color: populating ? `${accentColor}80` : accentColor,
                    cursor: populating ? "not-allowed" : "pointer",
                  }}
                >
                  {populating
                    ? <><Loader size={13} className="spin" /> Populating…</>
                    : <><Sparkles size={13} /> Populate Data</>}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sync result */}
        <AnimatePresence>
          {syncMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{
                marginBottom: "1rem", padding: "10px 14px", borderRadius: 10,
                background: syncMsg.ok ? "rgba(34,197,94,0.07)" : "rgba(244,63,94,0.07)",
                border: `1px solid ${syncMsg.ok ? "rgba(34,197,94,0.2)" : "rgba(244,63,94,0.2)"}`,
                fontSize: "0.875rem", color: syncMsg.ok ? "#22c55e" : "#f43f5e",
              }}
            >
              {syncMsg.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#475569", padding: "3rem 0" }}>
            <Loader size={18} className="spin" />
            <span>Loading team members…</span>
          </div>
        ) : members.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "4rem 2rem",
            border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 16,
          }}>
            <Shield size={40} color="#334155" style={{ marginBottom: "1rem" }} />
            <p style={{ fontSize: "1rem", color: "#64748b", fontWeight: 600 }}>No team members yet</p>
            <p style={{ fontSize: "0.875rem", color: "#334155", marginTop: 4 }}>
              Click "Sync from Discord" to pull your team from Discord, or add members manually.
            </p>
          </div>
        ) : (
          <>
            {/* Active members grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "0.875rem",
              marginBottom: inactiveMembers.length > 0 ? "2rem" : 0,
            }}>
              <AnimatePresence>
                {activeMembers.map(m => (
                  <MemberCard key={m.id} member={m} onEdit={openEdit} onDelete={deleteMember} />
                ))}
              </AnimatePresence>
            </div>

            {/* Inactive members */}
            {inactiveMembers.length > 0 && (
              <div>
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  marginBottom: "0.75rem",
                }}>
                  <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,0.05)" }} />
                  <span style={{ fontSize: "10px", color: "#334155", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
                    Inactive ({inactiveMembers.length})
                  </span>
                  <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,0.05)" }} />
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: "0.875rem",
                  opacity: 0.6,
                }}>
                  <AnimatePresence>
                    {inactiveMembers.map(m => (
                      <MemberCard key={m.id} member={m} onEdit={openEdit} onDelete={deleteMember} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <MemberModal
            member={editingMember}
            onClose={closeModal}
            onSave={saveMember}
          />
        )}
      </AnimatePresence>
    </>
  );
}
