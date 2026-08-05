"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen, Lock, Sparkles, Mic, FileText, History, Plus, Search, Shield,
  BarChart3, Save, RotateCcw, X, Trash2, Archive, ArchiveRestore, Pencil,
  AlertTriangle, Eye, Check, Coins, Folder, List, BookMarked,
} from "lucide-react";
import { Panel, Pill, Btn, Empty, SUPPORT_ACCENT, Loading, ErrorBox } from "../ui";
import {
  getDocs, getDocVersions, saveDoc, createDoc, revertDoc, getCategories,
  deleteDoc, getDocPreview,
} from "../api";

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
    blurb: "How we sound. Normally unscoped, so it loads into every draft — but a scope is honoured if you set one.",
  },
};

export default function DocsPage() {
  const [kind, setKind]   = useState<string>("all");
  const [q, setQ]         = useState("");
  const [docs, setDocs]   = useState<any[] | null>(null);
  const [cats, setCats]   = useState<any[]>([]);
  const [sel, setSel]     = useState<any>(null);
  const [err, setErr]     = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [editing, setEditing]   = useState(false);
  const [content, setContent]   = useState("");
  const [busy, setBusy]         = useState(false);
  const [note, setNote]         = useState<string | null>(null);
  const [versions, setVersions] = useState<any[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind]   = useState("reference");

  const [preview, setPreview]   = useState<any>(null);
  const [previewCat, setPreviewCat] = useState("");
  /** "list" edits one doc; "playbook" reads them all as one page. */
  const [view, setView] = useState<"list" | "playbook">("list");
  const [folderDraft, setFolderDraft] = useState("");

  const load = useCallback(async (keepId?: string) => {
    setErr(null);
    try {
      const [d, c] = await Promise.all([getDocs(undefined, showArchived), getCategories()]);
      setDocs(d); setCats(c);
      setSel(prev => {
        const next = (keepId && d.find((x: any) => x.id === keepId))
          || (prev && d.find((x: any) => x.id === prev.id))
          || d[0] || null;
        if (next) { setContent(next.content ?? ""); setTitleDraft(next.title ?? ""); }
        return next;
      });
    } catch (e: any) { setErr(e.message); setDocs([]); }
  }, [showArchived]);

  useEffect(() => { load(); }, [load]);

  const refreshPreview = useCallback(async (cat: string) => {
    try { setPreview(await getDocPreview(cat || undefined)); }
    catch { setPreview(null); }
  }, []);
  useEffect(() => { refreshPreview(previewCat); }, [previewCat, refreshPreview, docs]);

  const pick = (d: any) => {
    setSel(d); setContent(d.content ?? ""); setTitleDraft(d.title ?? "");
    setEditing(false); setVersions(null); setNote(null); setErr(null);
    setRenaming(false); setConfirmDelete(false); setFolderDraft(d.folder ?? "");
  };

  const act = async (fn: () => Promise<any>, msg: string | ((r: any) => string), keepId?: string) => {
    setBusy(true); setErr(null); setNote(null);
    try {
      const r = await fn();
      setNote(typeof msg === "function" ? msg(r) : msg);
      await load(keepId);
      return r;
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (err && docs === null) return <ErrorBox error={err} onRetry={() => load()} />;
  if (docs === null) return <Loading label="Loading documents" />;

  const list = docs
    .filter(d => kind === "all" || d.kind === kind)
    .filter(d => !q.trim() || `${d.title} ${d.content}`.toLowerCase().includes(q.toLowerCase()));

  const meta = sel ? (KIND_META[sel.kind] ?? KIND_META.reference) : KIND_META.reference;
  const SelIcon = meta.icon;
  const catLabel = (slug: string) => cats.find(c => c.slug === slug)?.label ?? slug;
  const needsReview = docs.filter(d => d.needs_review && d.is_active);

  // Folders are a human affordance only. The agent still loads documents
  // individually, because the document is the unit of scoping.
  const grouped: Record<string, any[]> = {};
  list.forEach(d => (grouped[d.folder || "Uncategorised"] ??= []).push(d));
  const folderNames = Object.keys(grouped).sort();
  const knownFolders = Array.from(new Set(docs.map(d => d.folder).filter(Boolean))) as string[];

  return (
    <>
      {err && <ErrorBox error={err} />}

      {/* Unresolved decisions surface here rather than being buried in a doc. */}
      {needsReview.length > 0 && (
        <div style={{
          background: "rgba(245,168,64,0.07)", border: "1px solid rgba(245,168,64,0.28)",
          borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1.1rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <AlertTriangle size={14} color="#f5a840" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#f5a840" }}>
              {needsReview.length} document{needsReview.length === 1 ? "" : "s"} need a decision
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {needsReview.map(d => (
              <Pill key={d.id} color="#f5a840" active={sel?.id === d.id} onClick={() => pick(d)}>
                {d.title}
              </Pill>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: "0.7rem", marginBottom: "1.1rem",
                    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
        {Object.keys(KIND_META).map(k => {
          const m = KIND_META[k]; const Icon = m.icon;
          const n = docs.filter(d => d.kind === k && d.is_active).length;
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

      {/* What the agent actually loads, and what it costs. The usual answer to
          "why did the draft say that" is which documents were in scope. */}
      <Panel
        title="What the agent loads"
        subtitle="Pick a category to see exactly which documents go into that draft"
        right={
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <select value={previewCat} onChange={e => setPreviewCat(e.target.value)}
                    style={{ ...inputStyle, width: "auto", cursor: "pointer" }}>
              <option value="">Any / unclassified</option>
              {cats.filter(c => c.is_active).map(c => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>
            {preview && (
              <Pill color={preview.totalTokens > 4000 ? "#f43f5e" : SUPPORT_ACCENT} solid>
                <Coins size={9} /> ~{preview.totalTokens.toLocaleString()} tokens
              </Pill>
            )}
          </div>
        }
      >
        {!preview ? <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>—</div> : (
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {preview.docs.length === 0
              ? <span style={{ fontSize: 11.5, color: "#f5a840" }}>
                  Nothing loads for this category — every draft would be a guess.
                </span>
              : preview.docs.map((d: any) => (
                  <Pill key={d.id} color={KIND_META[d.kind]?.color ?? "#6b7280"}
                        title={`${d.tokenEstimate} tokens${d.always ? " · always loaded" : ""}`}
                        onClick={() => { const full = docs.find(x => x.id === d.id); if (full) pick(full); }}>
                    {d.title} · {d.tokenEstimate}
                  </Pill>
                ))}
          </div>
        )}
      </Panel>

      <div style={{ height: "0.9rem" }} />

      <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.9rem" }}>
        <Pill color={SUPPORT_ACCENT} active={view === "list"} onClick={() => setView("list")}>
          <List size={9} /> Edit
        </Pill>
        <Pill color="#a78bfa" active={view === "playbook"} onClick={() => setView("playbook")}>
          <BookMarked size={9} /> Read the playbook
        </Pill>
      </div>

      {view === "playbook" ? (
        /* The whole thing as one page, in folder order. Same documents the agent
           loads — this is a reading view, not a second copy that can drift. */
        <Panel title="The playbook"
               subtitle="Everything active, in order. Click any heading to edit it.">
          {folderNames.length === 0 ? (
            <Empty icon={BookOpen} title="Nothing to read yet" />
          ) : folderNames.map(folderName => (
            <div key={folderName} style={{ marginBottom: "1.6rem" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 7, marginBottom: "0.7rem",
                paddingBottom: "0.4rem", borderBottom: "1px solid rgba(255,255,255,0.07)",
              }}>
                <Folder size={13} color={SUPPORT_ACCENT} />
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase",
                               letterSpacing: "0.08em", color: SUPPORT_ACCENT }}>{folderName}</span>
              </div>
              {grouped[folderName].filter((d: any) => d.is_active).map((d: any) => (
                <div key={d.id} style={{ marginBottom: "1.1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5,
                                cursor: "pointer" }}
                       onClick={() => { pick(d); setView("list"); }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{d.title}</span>
                    <Pill color={KIND_META[d.kind]?.color ?? "#6b7280"}>{d.kind}</Pill>
                    {(d.scope ?? []).length === 0
                      ? <Pill color="#f5a840">every draft</Pill>
                      : <Pill>{d.scope.length} categor{d.scope.length === 1 ? "y" : "ies"}</Pill>}
                    {d.needs_review && <AlertTriangle size={11} color="#f5a840" />}
                  </div>
                  <div style={{
                    fontSize: 12.5, lineHeight: 1.75, color: "var(--text-secondary)",
                    whiteSpace: "pre-wrap", paddingLeft: "0.9rem",
                    borderLeft: "2px solid rgba(255,255,255,0.06)",
                  }}>{d.content || "(empty)"}</div>
                </div>
              ))}
            </div>
          ))}
        </Panel>
      ) : (
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
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                     placeholder="Document title…" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
              <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.55rem", flexWrap: "wrap" }}>
                {Object.keys(KIND_META).map(k => (
                  <Pill key={k} color={KIND_META[k].color} active={newKind === k} onClick={() => setNewKind(k)}>
                    {KIND_META[k].label}
                  </Pill>
                ))}
              </div>
              <Btn size="sm" color={SUPPORT_ACCENT} disabled={!newTitle.trim() || busy}
                   onClick={async () => {
                     const d = await act(() => createDoc({ title: newTitle.trim(), kind: newKind, content: "" }),
                       "Created.");
                     if (d) { setCreating(false); setNewTitle(""); await load(d.id); setEditing(true); }
                   }}>
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
              <Pill color="#6b7280" active={showArchived} onClick={() => setShowArchived(!showArchived)}>
                <Archive size={9} /> Archived
              </Pill>
            </div>
          </div>

          {list.length === 0 ? (
            <Empty icon={BookOpen} title={docs.length ? "No documents match" : "No documents yet"} />
          ) : folderNames.map(folderName => (
            <div key={folderName}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "0.5rem 0.9rem", background: "rgba(255,255,255,0.025)",
                borderTop: "1px solid rgba(255,255,255,0.05)",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <Folder size={11} color="var(--text-muted)" />
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                               letterSpacing: "0.08em", color: "var(--text-secondary)" }}>
                  {folderName}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{grouped[folderName].length}</span>
              </div>
              {grouped[folderName].map((d: any) => {
                const m = KIND_META[d.kind] ?? KIND_META.reference;
                const Icon = m.icon;
                const active = d.id === sel?.id;
                return (
                  <div key={d.id} onClick={() => pick(d)}
                    style={{
                      padding: "0.6rem 0.9rem 0.6rem 1.5rem", cursor: "pointer",
                      background: active ? `${m.color}12` : "transparent",
                      borderLeft: `2px solid ${active ? m.color : "transparent"}`,
                      opacity: d.is_active ? 1 : 0.5,
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                      <Icon size={11} color={m.color} />
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{d.title}</span>
                      {d.needs_review && d.is_active && <AlertTriangle size={10} color="#f5a840" />}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <Pill color={m.color}>v{d.version}</Pill>
                      <Pill><BarChart3 size={8} /> {d.used_in_drafts}</Pill>
                      {!d.is_active && <Pill color="#6b7280" solid>archived</Pill>}
                      {d.is_active && (d.scope ?? []).length === 0 && <Pill color="#f5a840">always</Pill>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </Panel>

        {!sel ? (
          <Panel title="No document selected">
            <Empty icon={BookOpen} title="Create your first document"
                   body="Reference docs are the ground truth every draft is checked against." />
          </Panel>
        ) : (
          <Panel
            title={renaming ? "Rename" : sel.title}
            subtitle={`v${sel.version} · updated by ${sel.updated_by ?? "—"} · ~${sel.token_estimate} tokens whenever it loads`}
            right={
              <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                <Btn size="sm" variant="ghost" onClick={async () => {
                  if (versions) { setVersions(null); return; }
                  try { setVersions(await getDocVersions(sel.id)); } catch (e: any) { setErr(e.message); }
                }}>
                  <History size={11} /> {versions ? "Hide" : "Versions"}
                </Btn>
                {editing ? (
                  <>
                    <Btn size="sm" variant="ghost"
                         onClick={() => { setEditing(false); setContent(sel.content ?? ""); }}>Cancel</Btn>
                    <Btn size="sm" color={meta.color} disabled={busy}
                         onClick={() => act(() => saveDoc(sel.id, { content, note: "edited in Mission Control" }),
                           r => `Saved as v${r.version}.`, sel.id).then(() => setEditing(false))}>
                      <Save size={11} /> {busy ? "Saving…" : "Save"}
                    </Btn>
                  </>
                ) : (
                  <Btn size="sm" variant="outline" color={meta.color} onClick={() => setEditing(true)}>Edit</Btn>
                )}
              </div>
            }
          >
            {note && <div style={{ fontSize: 11.5, color: "#22c55e", fontWeight: 600, marginBottom: "0.7rem" }}>{note}</div>}

            {err?.includes("Refusing to shrink") && (
              <div style={{ background: "rgba(245,168,64,0.08)", border: "1px solid rgba(245,168,64,0.3)",
                            borderRadius: 9, padding: "0.6rem 0.75rem", marginBottom: "0.8rem" }}>
                <div style={{ fontSize: 11.5, color: "#f5a840", lineHeight: 1.55, marginBottom: 8 }}>
                  The shrink guard held this back. It exists because a whole-document rewrite that
                  silently eats most of a policy is very hard to notice later.
                </div>
                <Btn size="sm" color="#f5a840"
                     onClick={() => act(() => saveDoc(sel.id, { content, force: true, note: "forced save" }),
                       r => `Saved as v${r.version}.`, sel.id).then(() => setEditing(false))}>
                  Save anyway
                </Btn>
              </div>
            )}

            {/* Title */}
            {renaming ? (
              <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.9rem" }}>
                <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)} style={inputStyle} autoFocus />
                <Btn size="sm" color={meta.color} disabled={!titleDraft.trim() || busy}
                     onClick={() => act(() => saveDoc(sel.id, { title: titleDraft.trim() }), "Renamed.", sel.id)
                       .then(() => setRenaming(false))}>
                  <Check size={11} /> Save
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => { setRenaming(false); setTitleDraft(sel.title); }}>
                  Cancel
                </Btn>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.9rem",
                            alignItems: "center" }}>
                <Btn size="sm" variant="ghost" onClick={() => setRenaming(true)}>
                  <Pencil size={11} /> Rename
                </Btn>

                <select
                  value={sel.folder ?? ""}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === "__new") { setFolderDraft(""); return; }
                    act(() => saveDoc(sel.id, { folder: v || null }),
                      v ? `Moved to ${v}.` : "Removed from its folder.", sel.id);
                  }}
                  style={{ ...inputStyle, width: "auto", cursor: "pointer" }}
                >
                  <option value="">No folder</option>
                  {knownFolders.sort().map(f => <option key={f} value={f}>{f}</option>)}
                </select>

                {/* Kind */}
                {Object.keys(KIND_META).map(k => (
                  <Pill key={k} color={KIND_META[k].color} active={sel.kind === k}
                        onClick={() => sel.kind !== k && act(() => saveDoc(sel.id, { kind: k }),
                          `Now a ${KIND_META[k].label.toLowerCase()} document.`, sel.id)}>
                    {KIND_META[k].label}
                  </Pill>
                ))}

                <div style={{ flex: 1 }} />

                {sel.is_active ? (
                  confirmDelete ? (
                    <>
                      <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Btn>
                      <Btn size="sm" color="#f5a840" disabled={busy}
                           onClick={() => act(() => deleteDoc(sel.id, false),
                             "Archived — it no longer loads into any draft, and its history is intact.", sel.id)
                             .then(() => setConfirmDelete(false))}>
                        <Archive size={11} /> Archive
                      </Btn>
                      <Btn size="sm" color="#f43f5e" disabled={busy}
                           onClick={() => act(() => deleteDoc(sel.id, true), "Deleted permanently.")
                             .then(() => { setConfirmDelete(false); setSel(null); })}>
                        <Trash2 size={11} /> Delete forever
                      </Btn>
                    </>
                  ) : (
                    <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
                      <Trash2 size={11} /> Remove
                    </Btn>
                  )
                ) : (
                  <Btn size="sm" variant="outline" color="#22c55e" disabled={busy}
                       onClick={() => act(() => saveDoc(sel.id, { isActive: true }), "Restored.", sel.id)}>
                    <ArchiveRestore size={11} /> Restore
                  </Btn>
                )}
              </div>
            )}

            {confirmDelete && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.55, marginBottom: "0.8rem" }}>
                <strong style={{ color: "#f5a840" }}>Archive</strong> takes it out of every prompt but keeps
                the content and all {sel.version} version{sel.version === 1 ? "" : "s"} — reversible.{" "}
                <strong style={{ color: "#f43f5e" }}>Delete forever</strong> destroys both.
              </div>
            )}

            {/* Review note — human-facing, never sent to the model */}
            {sel.review_note && (
              <div style={{
                background: sel.needs_review ? "rgba(245,168,64,0.06)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${sel.needs_review ? "rgba(245,168,64,0.28)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 9, padding: "0.7rem 0.8rem", marginBottom: "0.9rem",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  {sel.needs_review && <AlertTriangle size={11} color="#f5a840" />}
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                                 letterSpacing: "0.07em",
                                 color: sel.needs_review ? "#f5a840" : "var(--text-muted)" }}>
                    Note for you — never sent to the agent
                  </span>
                  <div style={{ flex: 1 }} />
                  {sel.needs_review && (
                    <Btn size="sm" variant="ghost" disabled={busy}
                         onClick={() => act(() => saveDoc(sel.id, { needsReview: false }), "Marked resolved.", sel.id)}>
                      <Check size={10} /> Resolved
                    </Btn>
                  )}
                </div>
                <div style={{ fontSize: 11.5, lineHeight: 1.65, color: "var(--text-secondary)",
                              whiteSpace: "pre-wrap" }}>{sel.review_note}</div>
              </div>
            )}

            {/* Scope */}
            <div style={{ marginBottom: "0.9rem" }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                            letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6 }}>
                Loads for {(sel.scope ?? []).length === 0
                  ? "every category" : `${sel.scope.length} categor${sel.scope.length === 1 ? "y" : "ies"}`}
              </div>
              <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                {cats.filter(c => c.is_active).map(c => {
                  const on = (sel.scope ?? []).includes(c.slug);
                  return (
                    <Pill key={c.slug} color={SUPPORT_ACCENT} active={on} onClick={() => {
                      const next = on ? sel.scope.filter((s: string) => s !== c.slug)
                                      : [...(sel.scope ?? []), c.slug];
                      act(() => saveDoc(sel.id, { scope: next }),
                        next.length === 0
                          ? "Scope cleared — now loads into every draft."
                          : `Loads for ${next.length} categor${next.length === 1 ? "y" : "ies"}.`, sel.id);
                    }}>{c.label}</Pill>
                  );
                })}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
                {(sel.scope ?? []).length === 0
                  ? `No scope means this loads into every single draft — ${sel.token_estimate} tokens each time. Correct for voice and hard constraints, wasteful for anything category-specific.`
                  : "Only drafts in these categories see it."}
              </div>
            </div>

            {versions && (
              <div style={{ marginBottom: "0.9rem", border: "1px solid rgba(255,255,255,0.07)",
                            borderRadius: 9, overflow: "hidden" }}>
                {versions.map((v, i) => (
                  <div key={v.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "0.5rem 0.75rem",
                    borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)", fontSize: 11.5,
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
                           onClick={() => act(() => revertDoc(sel.id, v.version), `Reverted to v${v.version}.`, sel.id)
                             .then(() => setVersions(null))}>
                        <RotateCcw size={10} /> Revert
                      </Btn>
                    )}
                  </div>
                ))}
              </div>
            )}

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
              <Eye size={11} />
              This is exactly what the agent sees — nothing above it is added to the prompt.
            </div>
          </Panel>
        )}
      </div>
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
  padding: "0.35rem 0.6rem", fontSize: 11.5,
  color: "var(--text-primary)", fontFamily: "inherit", outline: "none",
};
