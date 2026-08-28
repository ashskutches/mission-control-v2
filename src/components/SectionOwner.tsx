"use client";
/**
 * Who owns this space — the human, not the agent.
 *
 * `lead_agent_id` answers "who works this area". This answers "whose department is
 * this", which is a different question and had no home: the Team page's **Role**
 * dropdown is a person's job function, and `team_members.areas` is a free-text
 * many-to-many list on the person that nothing validates — two people can claim a
 * space, or claim one that does not exist. Ownership is therefore one column on the
 * space (`business_sections.owner_member_id`) pointing at one member.
 *
 * Standalone rather than folded into SectionAgentPanel, for two reasons:
 *   - the panel has an unassigned and an assigned branch, so anything inside it has
 *     to be written twice or vanishes in one state;
 *   - five spaces (Social, Logistics, Orders, Support, Brand) have no panel at all,
 *     and those pages need an owner as much as the others do.
 *
 * Reads the same `GET /admin/sections` the panel does. A space with no row yet is
 * returned by that endpoint with nulls rather than omitted, so an unowned space
 * renders as "Unassigned" instead of an error — the row is created on first write.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { UserCircle2, ChevronDown, X, Check, Loader } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

interface Member {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  active?: boolean | null;
}

/** Only the fields this component reads off GET /admin/sections. */
interface SectionRow {
  id: string;
  owner?: Member | null;
}

export interface SectionOwnerProps {
  /** A space id from lib/spaces.tsx — must match `business_sections.id`. */
  sectionId: string;
  sectionName: string;
  accentColor?: string;
  /** Fired after a successful assign or unassign. */
  onOwnerChanged?: (owner: Member | null) => void;
}

const nameOf = (m: Member) => m.display_name?.trim() || m.username;

export default function SectionOwner({
  sectionId, sectionName, accentColor = "#a78bfa", onOwnerChanged,
}: SectionOwnerProps) {
  const [owner, setOwner] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const [secRes, memRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/sections`),
        fetch(`${BOT_URL}/admin/team`),
      ]);
      if (secRes.ok) {
        const sections: SectionRow[] = await secRes.json();
        const row = (Array.isArray(sections) ? sections : []).find(s => s.id === sectionId);
        setOwner(row?.owner ?? null);
      }
      if (memRes.ok) {
        const body = await memRes.json();
        const list: Member[] = Array.isArray(body) ? body : (body.data ?? body.members ?? []);
        // Inactive members stay assignable only if one already owns this space —
        // silently dropping the current owner from the list would make the strip
        // read "Unassigned" the moment someone goes inactive.
        setMembers(list.filter(m => m.active !== false));
      }
    } catch {
      /* the strip degrades to Unassigned rather than blocking the page */
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => { load(); }, [load]);

  // Close the picker on an outside click. Without this it stays open behind the
  // next thing you click, over a page that is mostly tables.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const assign = async (member: Member | null) => {
    setSaving(true);
    setError(null);
    try {
      const res = member
        ? await fetch(`${BOT_URL}/admin/sections/${sectionId}/owner`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ member_id: member.id }),
          })
        : await fetch(`${BOT_URL}/admin/sections/${sectionId}/owner`, { method: "DELETE" });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      setOwner(member);
      onOwnerChanged?.(member);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={boxRef}
      style={{
        position: "relative",
        display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10, padding: "0.5rem 0.75rem",
        marginBottom: "0.75rem",
      }}
    >
      <span style={{
        fontSize: 9, fontWeight: 800, color: "#475569",
        textTransform: "uppercase", letterSpacing: "0.1em",
      }}>
        Department owner
      </span>

      {loading ? (
        <span style={{ fontSize: 11, color: "#475569" }}>…</span>
      ) : owner ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
          {owner.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={owner.avatar_url} alt="" width={20} height={20}
                 style={{ borderRadius: "50%", border: `1px solid ${accentColor}44` }} />
          ) : (
            <span style={{
              width: 20, height: 20, borderRadius: "50%",
              background: `${accentColor}1a`, border: `1px solid ${accentColor}44`,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 800, color: accentColor,
            }}>
              {nameOf(owner).slice(0, 1).toUpperCase()}
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{nameOf(owner)}</span>
          {owner.role && <span style={{ fontSize: 10, color: "#64748b" }}>· {owner.role}</span>}
        </span>
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: 11, color: "#b45309" }}>
          <UserCircle2 size={13} />
          Unassigned — nobody owns {sectionName}
        </span>
      )}

      <div style={{ marginLeft: "auto", display: "flex", gap: "0.35rem", alignItems: "center" }}>
        {saving && <Loader size={12} className="spin" color="#475569" />}
        <button
          onClick={() => setOpen(o => !o)}
          disabled={saving}
          style={{
            background: "rgba(255,255,255,0.04)", color: "#94a3b8",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7,
            padding: "0.2rem 0.6rem", cursor: saving ? "not-allowed" : "pointer",
            fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.25rem",
          }}
        >
          {owner ? "Change" : "Assign"} <ChevronDown size={11} />
        </button>
        {owner && (
          <button
            onClick={() => assign(null)}
            disabled={saving}
            title={`Remove ${nameOf(owner)} as owner of ${sectionName}`}
            style={{
              background: "rgba(244,63,94,0.08)", color: "#f43f5e",
              border: "1px solid rgba(244,63,94,0.2)", borderRadius: 7,
              padding: "0.2rem 0.4rem", cursor: saving ? "not-allowed" : "pointer",
              display: "inline-flex", alignItems: "center",
            }}
          >
            <X size={11} />
          </button>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 10, color: "#f43f5e", width: "100%", margin: 0 }}>⚠ {error}</p>
      )}

      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, zIndex: 30, marginTop: 4,
          minWidth: 240, maxHeight: 280, overflowY: "auto",
          background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, padding: "0.35rem", boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
        }}>
          {members.length === 0 ? (
            <p style={{ fontSize: 11, color: "#475569", padding: "0.5rem 0.6rem" }}>
              No team members. Add them on the Team page, or run a Discord sync.
            </p>
          ) : members.map(m => {
            const isOwner = m.id === owner?.id;
            return (
              <button
                key={m.id}
                onClick={() => assign(m)}
                disabled={saving}
                style={{
                  width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: "0.5rem",
                  background: isOwner ? `${accentColor}14` : "transparent",
                  border: "none", borderRadius: 7, padding: "0.4rem 0.6rem",
                  cursor: saving ? "not-allowed" : "pointer", color: "#cbd5e1", fontSize: 12,
                }}
              >
                {m.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={m.avatar_url} alt="" width={18} height={18} style={{ borderRadius: "50%" }} />
                ) : (
                  <span style={{
                    width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.06)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, fontWeight: 800, color: "#94a3b8",
                  }}>
                    {nameOf(m).slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span style={{ flex: 1, fontWeight: isOwner ? 700 : 500 }}>{nameOf(m)}</span>
                {m.role && <span style={{ fontSize: 9.5, color: "#64748b" }}>{m.role}</span>}
                {isOwner && <Check size={12} color={accentColor} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
