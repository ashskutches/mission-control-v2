"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen, Lock, Sparkles, Mic, FileText, History, Plus, Search, Shield,
  BarChart3, Save, RotateCcw, X,
} from "lucide-react";
import { Panel, Pill, Btn, Empty, SUPPORT_ACCENT, Loading, ErrorBox } from "../ui";
import { getDocs, getDocVersions, saveDoc, createDoc, revertDoc, getCategories } from "../api";

const KIND_META: Record<string, { label: string; color: string; icon: any; blurb: string }> = {
  reference: {
    label: "Reference", color: "#4a9eff", icon: Lock,
    blurb: "Human ground truth — policies, timings, what we will and won't do. The agent reads these and may only propose changes, never edit them.",
  },
  learned: {
    label: "Learned", color: "#a78bfa", icon: Sparkles,
    blurb: "Written by the agent from its own corrections, accepted by a human. This is where the loop shows up as something you can read.",
  },
  voice: {
    label: "Voice", color: "#f5a840", icon: Mic,
    blurb: "How we sound. Loaded into every draft regardless of category.",
  },
};

export default function DocsPage() {
  const [kind, setKind]   = useState<string>("all");
  const [q, setQ]         = useState("");
  const [docs, setDocs]   = useState<any[] | null>(null);
  const [cats, setCats]   = useState<any[]>([]);
  const [sel, setSel]     = useState<any>(null);
  const [err, setErr]     = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");
  const [busy, setBusy]       = useState(false);
  const [note, setNote]       = useState<string | null>(null);
  const [versions, setVersions] = useState<any[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind]   = useState("reference");

  const load = useCallback(async (keepId?: string) => {
    setErr(null);
    try {
      const [d, c] = await Promise.all([getDocs(), getCategories()]);
      setDocs(d); setCats(c);
      const next = keepId ? d.find((x: any) => x.id === keepId) : (sel ? d.find((x: any) => x.id === sel.id) : d[0]);
      setSel(next ?? d[0] ?? null);
      if (next ?? d[0]) setContent((next ?? d[0]).content ?? "");
    } catch (e: any) { setErr(e.message); setDocs([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const pick = (d: any) => { setSel(d); setContent(d.content ?? ""); setEditing(false); setVersions(null); setNote(null); };

  const save = async (force = false) => {
    if (!sel) return;
    setBusy(true); setErr(null); setNote(null);
    try {
      const r = await saveDoc(sel.id, { content, note: "edited in Mission Control", force });
      setNote(`Saved as v${r.version}.`);
      setEditing(false);
      await load(sel.id);
    } catch (e: any) {
      // The shrink guard returns 409 — offer the override rather than just failing.
      if (e.status === 409) {
        setErr(`${e.message}`);
      } else setErr(e.message);
    } finally { setBusy(false); }
  };

  const doCreate = async () => {
    if (!newTitle.trim()) return;
    setBusy(true); setErr(null);
    try {
      const d = await createDoc({ title: newTitle.trim(), kind: newKind, content: "" });
      setCreating(false); setNewTitle("");
      await load(d.id);
      setEditing(true);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const showVersions = async () => {
    if (!sel) return;
    if (versions) { setVersions(null); return; }
    try { setVersions(await getDocVersions(sel.id)); } catch (e: any) { setErr(e.message); }
  };

  if (err && docs === null) return <ErrorBox error={err} onRetry={() => load()} />;
  if (docs === null) return <Loading label="Loading documents" />;

  const list = docs
    .filter(d => kind === "all" || d.kind === kind)
    .filter(d => !q.trim() || `${d.title} ${d.content}`.toLowerCase().includes(q.toLowerCase()));

  const meta = sel ? (KIND_META[sel.kind] ?? KIND_META.reference) : KIND_META.reference;
  const SelIcon = meta.icon;
  const catLabel = (slug: string) => cats.find(c => c.slug === slug)?.label ?? slug;

  return (
    <>
      {err && <ErrorBox error={err} />}

      <div style={{ display: "grid", gap: "0.7rem", marginBottom: "1.1rem",
                    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
        {Object.keys(KIND_META).map(k => {
          const m = KIND_META[k]; const Icon = m.icon;
          const n = docs.filter(d => d.kind === k).length;
          return (
            <div key={k} style={{
              background: "var(--bg-darker)", border: `1px solid ${m.color}28`,
              borderRadius: 12, padding: "0.8rem 0.9rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                <Icon size={13} color={m.color} />
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase",
                               letterSpacing: "0.07em", color: m.color }}>{m.label}</span>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{n}</span>
              </div>
              <div style={{ fontSize: 11, lineHeight: 1.55, color: "var(--text-muted)" }}>{m.blurb}</div>
            </div>
          );
        })}
      </div>

      {docs.length === 0 && (
        <div style={{
          background: "rgba(245,168,64,0.07)", border: "1px solid rgba(245,168,64,0.28)",
          borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1.1rem",
          fontSize: 11.5, color: "#f5a840", lineHeight: 1.6,
        }}>
          <strong>The knowledge base is empty.</strong> Until there's at least a voice doc and one
          policy doc, every draft will be low-confidence and will escalate rather than answer — which
          is correct behaviour, but not useful. Start with shipping times, returns/refunds, and brand voice.
        </div>
      )}

      <div style={{ display: "grid", gap: "0.9rem",
                    gridTemplateColumns: "minmax(280px, 0.85fr) minmax(400px, 1.6fr)",
                    alignItems: "start" }}>

        <Panel
          title="Documents"
          right={<Btn size="sm" variant="outline" color={SUPPORT_ACCENT} onClick={() => setCreating(!creating)}>
            {creating ? <X size={11} /> : <Plus size={11} />} {creating ? "Cancel" : "New"}
          </Btn>}
          pad={false}
        >
          {creating && (
            <div style={{ padding: "0.8rem", borderBottom: "1px solid rgba(255,255,255,0.06)",
                          background: "rgba(255,255,255,0.02)" }}>
              <input
                value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="Document title…"
                style={{ ...inputStyle, marginBottom: "0.5rem" }}
              />
              <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.55rem", flexWrap: "wrap" }}>
                {Object.keys(KIND_META).map(k => (
                  <Pill key={k} color={KIND_META[k].color} active={newKind === k} onClick={() => setNewKind(k)}>
                    {KIND_META[k].label}
                  </Pill>
                ))}
              </div>
              <Btn size="sm" color={SUPPORT_ACCENT} disabled={!newTitle.trim() || busy} onClick={doCreate}>
                Create
              </Btn>
            </div>
          )}

          <div style={{ padding: "0.7rem 0.8rem", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ position: "relative", marginBottom: "0.55rem" }}>
              <Search size={12} style={{ position: "absolute", left: 9, top: "50%",
                                         transform: "translateY(-50%)", color: "var(--text-dim)" }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
                     style={{ ...inputStyle, paddingLeft: "1.75rem" }} />
            </div>
            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
              <Pill color={SUPPORT_ACCENT} active={kind === "all"} onClick={() => setKind("all")}>All</Pill>
              {Object.keys(KIND_META).map(k => (
                <Pill key={k} color={KIND_META[k].color} active={kind === k} onClick={() => setKind(k)}>
                  {KIND_META[k].label}
                </Pill>
              ))}
            </div>
          </div>

          {list.length === 0 ? (
            <Empty icon={BookOpen} title={docs.length ? "No documents match" : "No documents yet"} />
          ) : list.map((d, i) => {
            const m = KIND_META[d.kind] ?? KIND_META.reference;
            const Icon = m.icon;
            const active = d.id === sel?.id;
            return (
              <div key={d.id} onClick={() => pick(d)}
                style={{
                  padding: "0.7rem 0.9rem", cursor: "pointer",
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
                  background: active ? `${m.color}12` : "transparent",
                  borderLeft: `2px solid ${active ? m.color : "transparent"}`,
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <Icon size={11} color={m.color} />
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{d.title}</span>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <Pill color={m.color}>v{d.version}</Pill>
                  <Pill><BarChart3 size={8} /> {d.used_in_drafts} drafts</Pill>
                  {(d.scope ?? []).length === 0 && <Pill color="#f5a840">always loaded</Pill>}
                </div>
              </div>
            );
          })}
        </Panel>

        {!sel ? (
          <Panel title="No document selected">
            <Empty icon={BookOpen} title="Create your first document"
                   body="Reference docs are the ground truth every draft is checked against." />
          </Panel>
        ) : (
          <Panel
            title={sel.title}
            subtitle={`v${sel.version} · updated by ${sel.updated_by ?? "—"} · ~${sel.token_estimate} tokens in every matching prompt`}
            right={
              <div style={{ display: "flex", gap: "0.35rem" }}>
                <Btn size="sm" variant="ghost" onClick={showVersions}>
                  <History size={11} /> {versions ? "Hide" : "Versions"}
                </Btn>
                {editing ? (
                  <>
                    <Btn size="sm" variant="ghost" onClick={() => { setEditing(false); setContent(sel.content ?? ""); }}>
                      Cancel
                    </Btn>
                    <Btn size="sm" color={meta.color} disabled={busy} onClick={() => save(false)}>
                      <Save size={11} /> {busy ? "Saving…" : "Save"}
                    </Btn>
                  </>
                ) : (
                  <Btn size="sm" variant="outline" color={meta.color} onClick={() => setEditing(true)}>Edit</Btn>
                )}
              </div>
            }
          >
            {note && (
              <div style={{ fontSize: 11.5, color: "#22c55e", fontWeight: 600, marginBottom: "0.7rem" }}>{note}</div>
            )}
            {err?.includes("Refusing to shrink") && (
              <div style={{ background: "rgba(245,168,64,0.08)", border: "1px solid rgba(245,168,64,0.3)",
                            borderRadius: 9, padding: "0.6rem 0.75rem", marginBottom: "0.8rem" }}>
                <div style={{ fontSize: 11.5, color: "#f5a840", lineHeight: 1.55, marginBottom: 8 }}>
                  The shrink guard held this back. It exists because a whole-document rewrite that
                  silently eats most of a policy is very hard to notice later.
                </div>
                <Btn size="sm" color="#f5a840" onClick={() => save(true)}>Save anyway</Btn>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
              <Pill color={meta.color} solid><SelIcon size={9} /> {meta.label}</Pill>
              <Pill color={sel.source === "human" ? "#4a9eff" : "#a78bfa"}>
                {sel.source === "human" ? "Human-authored" : "Agent-authored"}
              </Pill>
              {(sel.scope ?? []).length === 0
                ? <Pill color="#f5a840">Loaded into every draft</Pill>
                : sel.scope.map((s: string) => <Pill key={s}>{catLabel(s)}</Pill>)}
            </div>

            {sel.kind === "reference" && (
              <div style={{
                display: "flex", gap: 8, alignItems: "flex-start",
                background: "rgba(74,158,255,0.06)", border: "1px solid rgba(74,158,255,0.22)",
                borderRadius: 9, padding: "0.6rem 0.75rem", marginBottom: "0.9rem",
              }}>
                <Shield size={13} color="#4a9eff" style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 11, lineHeight: 1.55, color: "var(--text-secondary)" }}>
                  <strong>Read-only to the agent.</strong> It can propose an edit, which appears on the
                  Learning tab as a diff for you to accept. Every change bumps the version and is
                  revertible — a bad reference doc silently poisons every draft that cites it.
                </span>
              </div>
            )}

            {versions && (
              <div style={{ marginBottom: "0.9rem", border: "1px solid rgba(255,255,255,0.07)",
                            borderRadius: 9, overflow: "hidden" }}>
                {versions.map((v, i) => (
                  <div key={v.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "0.5rem 0.75rem",
                    borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
                    fontSize: 11.5,
                  }}>
                    <Pill>v{v.version}</Pill>
                    <span style={{ color: "var(--text-muted)", flex: 1, minWidth: 0,
                                   overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.note ?? "—"} · {v.created_by ?? "—"}
                    </span>
                    <span style={{ color: "var(--text-dim)", fontSize: 10.5 }}>
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                    {v.version !== sel.version && (
                      <Btn size="sm" variant="ghost"
                           onClick={async () => {
                             try { await revertDoc(sel.id, v.version); setNote(`Reverted to v${v.version}.`); await load(sel.id); setVersions(null); }
                             catch (e: any) { setErr(e.message); }
                           }}>
                        <RotateCcw size={10} /> Revert
                      </Btn>
                    )}
                  </div>
                ))}
              </div>
            )}

            {editing ? (
              <textarea
                value={content} onChange={e => setContent(e.target.value)} rows={22}
                style={{
                  width: "100%", background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                  padding: "1rem", fontSize: 12.5, lineHeight: 1.75,
                  color: "var(--text-primary)", fontFamily: "inherit",
                  resize: "vertical", outline: "none",
                }}
              />
            ) : (
              <div style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 10, padding: "1rem 1.1rem",
                fontSize: 12.5, lineHeight: 1.75, color: "var(--text-secondary)",
                whiteSpace: "pre-wrap", minHeight: 120,
              }}>
                {sel.content || "(empty — click Edit to write it)"}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: "0.9rem",
                          fontSize: 10.5, color: "var(--text-muted)" }}>
              <FileText size={11} />
              Scoped docs load only for their categories. Voice docs load always. That's what keeps
              the prompt from growing without limit as the library does.
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
  padding: "0.35rem 0.6rem", fontSize: 11.5,
  color: "var(--text-primary)", fontFamily: "inherit", outline: "none",
};
