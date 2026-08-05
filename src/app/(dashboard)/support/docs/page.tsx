"use client";
import React, { useState } from "react";
import {
  BookOpen, Lock, Sparkles, Mic, FileText, History, Plus, Search, Shield, BarChart3,
} from "lucide-react";
import { SampleBanner, Panel, Pill, Btn, Empty, SUPPORT_ACCENT } from "../ui";
import { DOCS, categoryLabel } from "../fixtures";
import type { DocKind, SupportDoc } from "../types";

const KIND_META: Record<DocKind, { label: string; color: string; icon: any; blurb: string }> = {
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
  const [kind, setKind]     = useState<DocKind | "all">("all");
  const [q, setQ]           = useState("");
  const [selected, setSel]  = useState<SupportDoc>(DOCS[0]);

  const list = DOCS
    .filter(d => kind === "all" || d.kind === kind)
    .filter(d => !q.trim() || `${d.title} ${d.content}`.toLowerCase().includes(q.toLowerCase()));

  const meta = KIND_META[selected.kind];
  const SelIcon = meta.icon;

  return (
    <>
      <SampleBanner />

      {/* Kind explainer */}
      <div style={{ display: "grid", gap: "0.7rem", marginBottom: "1.1rem",
                    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
        {(Object.keys(KIND_META) as DocKind[]).map(k => {
          const m = KIND_META[k];
          const Icon = m.icon;
          const n = DOCS.filter(d => d.kind === k).length;
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

      <div style={{ display: "grid", gap: "0.9rem",
                    gridTemplateColumns: "minmax(280px, 0.85fr) minmax(400px, 1.6fr)",
                    alignItems: "start" }}>

        {/* List */}
        <Panel
          title="Documents"
          right={<Btn size="sm" variant="outline" color={SUPPORT_ACCENT}><Plus size={11} /> New</Btn>}
          pad={false}
        >
          <div style={{ padding: "0.7rem 0.8rem", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ position: "relative", marginBottom: "0.55rem" }}>
              <Search size={12} style={{ position: "absolute", left: 9, top: "50%",
                                         transform: "translateY(-50%)", color: "var(--text-dim)" }} />
              <input
                value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
                style={{
                  width: "100%", background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
                  padding: "0.35rem 0.6rem 0.35rem 1.75rem", fontSize: 11.5,
                  color: "var(--text-primary)", fontFamily: "inherit", outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
              <Pill color={SUPPORT_ACCENT} active={kind === "all"} onClick={() => setKind("all")}>All</Pill>
              {(Object.keys(KIND_META) as DocKind[]).map(k => (
                <Pill key={k} color={KIND_META[k].color} active={kind === k} onClick={() => setKind(k)}>
                  {KIND_META[k].label}
                </Pill>
              ))}
            </div>
          </div>

          {list.length === 0 ? (
            <Empty icon={BookOpen} title="No documents match" />
          ) : list.map((d, i) => {
            const m = KIND_META[d.kind];
            const Icon = m.icon;
            const active = d.id === selected.id;
            return (
              <div
                key={d.id} onClick={() => setSel(d)}
                style={{
                  padding: "0.7rem 0.9rem", cursor: "pointer",
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
                  background: active ? `${m.color}12` : "transparent",
                  borderLeft: `2px solid ${active ? m.color : "transparent"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <Icon size={11} color={m.color} />
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{d.title}</span>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <Pill color={m.color}>v{d.version}</Pill>
                  <Pill><BarChart3 size={8} /> {d.usedInDrafts} drafts</Pill>
                  {d.scope.length === 0 && <Pill color="#f5a840">always loaded</Pill>}
                </div>
              </div>
            );
          })}
        </Panel>

        {/* Detail */}
        <Panel
          title={selected.title}
          subtitle={`v${selected.version} · updated by ${selected.updatedBy} · ~${selected.tokenEstimate} tokens in every matching prompt`}
          right={
            <div style={{ display: "flex", gap: "0.35rem" }}>
              <Btn size="sm" variant="ghost"><History size={11} /> Versions</Btn>
              <Btn size="sm" variant="outline" color={meta.color}>Edit</Btn>
            </div>
          }
        >
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
            <Pill color={meta.color} solid><SelIcon size={9} /> {meta.label}</Pill>
            <Pill color={selected.source === "human" ? "#4a9eff" : "#a78bfa"}>
              {selected.source === "human" ? "Human-authored" : "Agent-authored"}
            </Pill>
            {selected.scope.length === 0
              ? <Pill color="#f5a840">Loaded into every draft</Pill>
              : selected.scope.map(s => <Pill key={s}>{categoryLabel(s)}</Pill>)}
          </div>

          {selected.kind === "reference" && (
            <div style={{
              display: "flex", gap: 8, alignItems: "flex-start",
              background: "rgba(74,158,255,0.06)", border: "1px solid rgba(74,158,255,0.22)",
              borderRadius: 9, padding: "0.6rem 0.75rem", marginBottom: "0.9rem",
            }}>
              <Shield size={13} color="#4a9eff" style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: 11, lineHeight: 1.55, color: "var(--text-secondary)" }}>
                <strong>Read-only to the agent.</strong> It can propose an edit, which appears on the
                Learning tab as a diff for you to accept. Every accepted change bumps the version and
                is revertible — a bad reference doc silently poisons every draft that cites it.
              </span>
            </div>
          )}

          {selected.kind === "learned" && (
            <div style={{
              display: "flex", gap: 8, alignItems: "flex-start",
              background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.22)",
              borderRadius: 9, padding: "0.6rem 0.75rem", marginBottom: "0.9rem",
            }}>
              <Sparkles size={13} color="#a78bfa" style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: 11, lineHeight: 1.55, color: "var(--text-secondary)" }}>
                The agent wrote this from its own mistakes and you accepted it. It is cited in{" "}
                {selected.usedInDrafts} drafts so far.
              </span>
            </div>
          )}

          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 10, padding: "1rem 1.1rem",
            fontSize: 12.5, lineHeight: 1.75, color: "var(--text-secondary)",
            whiteSpace: "pre-wrap",
          }}>
            {selected.content}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: "0.9rem",
                        fontSize: 10.5, color: "var(--text-muted)" }}>
            <FileText size={11} />
            Scoped docs load only for their categories. Voice docs load always. This is what keeps
            the cached prompt block from growing without limit as the library does.
          </div>
        </Panel>
      </div>
    </>
  );
}
