"use client";
import React from "react";
import { Wrench, ExternalLink, CalendarClock, Sparkles, Plus, X } from "lucide-react";
import { Pill, Btn, SUPPORT_ACCENT } from "./ui";
import { ActionTypeDef, ResolutionPayload, OUTCOME_LABELS, OUTCOME_COLOR } from "./api";

/**
 * The resolution form — used by every terminal action on a ticket.
 *
 * One component, three callers (approve, reject-and-rewrite, close-out), because
 * the alternative is three forms that ask for the same things in different words
 * and drift. It is also why the rep never types the same thing twice: whichever
 * button they press, this is the form, and it carries over.
 *
 * ## The design constraint that shaped it
 *
 * At 20–60 tickets a day, a mandatory eight-field form per ticket guarantees
 * junk data — reps click through it and the corpus fills with "handled" and
 * "done". So: **nothing here is required unless the rep is closing the ticket**,
 * the common case (send the reply, nothing else happened) needs zero
 * interaction, and everything is a click rather than a sentence. The free-text
 * boxes are there for the specifics that a vocabulary genuinely cannot hold.
 */

export interface ActionDraft {
  key: string;
  detail: string;
  externalSystem: string | null;
  /** Unfinished work: becomes a planned follow-up and then needs an owner. */
  followup: boolean;
  owner: string;
  /** yyyy-mm-dd from the date input; widened to an ISO instant on submit. */
  dueAt: string;
}

export interface ResolutionState {
  outcome: string | null;
  summary: string;
  actions: ActionDraft[];
}

export const emptyResolution = (): ResolutionState => ({ outcome: null, summary: "", actions: [] });

export const newActionDraft = (key: string, def?: ActionTypeDef): ActionDraft => ({
  key,
  detail: "",
  externalSystem: def?.system ?? null,
  followup: false,
  owner: "",
  dueAt: "",
});

/** Anything at all to record? Drives whether the parent bothers sending it. */
export const hasResolutionContent = (s: ResolutionState) =>
  !!(s.outcome || s.summary.trim() || s.actions.length);

/**
 * What is stopping this being submitted, in the rep's words.
 *
 * Returned as a list rather than a boolean so the UI can say which field is
 * missing instead of just disabling the button — a disabled button with no
 * explanation is the single most common way a form dead-ends.
 */
export function resolutionProblems(s: ResolutionState, opts: { close: boolean }): string[] {
  const out: string[] = [];
  if (opts.close) {
    if (!s.outcome) out.push("Pick what the outcome was.");
    if (s.summary.trim().length < 15) {
      out.push(`The summary needs ${15 - s.summary.trim().length} more character(s).`);
    }
  }
  s.actions.forEach(a => {
    if (a.followup && !a.owner.trim()) {
      out.push(`"${a.key}" is unfinished work, so it needs an owner.`);
    }
    if (a.key === "other" && !a.detail.trim()) {
      out.push(`"Other" needs a description.`);
    }
  });
  return out;
}

/** Fold the form state into the shape the server takes. */
export function toPayload(s: ResolutionState, opts: { close: boolean }): ResolutionPayload {
  const asPayload = (a: ActionDraft) => ({
    actionType: a.key,
    detail: a.detail.trim(),
    externalSystem: a.externalSystem,
    // Local date → end of that day, so "due Friday" doesn't read as overdue at
    // 00:01 on Friday morning.
    dueAt: a.dueAt ? new Date(`${a.dueAt}T23:59:59`).toISOString() : null,
  });

  return {
    actions: s.actions.filter(a => !a.followup).map(a => ({ ...asPayload(a), status: "done" as const })),
    followups: s.actions.filter(a => a.followup)
      .map(a => ({ ...asPayload(a), status: "planned" as const, owner: a.owner.trim() })),
    outcome: s.outcome,
    resolutionSummary: s.summary.trim() || null,
    close: opts.close,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function ResolutionFields({
  value, onChange, vocabulary, suggested = [], showOutcome = true, outcomeRequired = false,
}: {
  value: ResolutionState;
  onChange: (next: ResolutionState) => void;
  vocabulary: { group: string; actions: ActionTypeDef[] }[];
  /** Action keys the draft predicted. Marked, not silently pre-ticked. */
  suggested?: string[];
  showOutcome?: boolean;
  outcomeRequired?: boolean;
}) {
  const defByKey = new Map(vocabulary.flatMap(g => g.actions).map(a => [a.key, a]));
  const selected = new Map(value.actions.map(a => [a.key, a]));

  const toggle = (key: string) => {
    if (selected.has(key)) {
      onChange({ ...value, actions: value.actions.filter(a => a.key !== key) });
    } else {
      onChange({ ...value, actions: [...value.actions, newActionDraft(key, defByKey.get(key))] });
    }
  };

  const patch = (key: string, p: Partial<ActionDraft>) => onChange({
    ...value,
    actions: value.actions.map(a => (a.key === key ? { ...a, ...p } : a)),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {showOutcome && (
        <div>
          <label style={labelStyle}>
            What was the outcome for the customer?
            {outcomeRequired && <span style={{ color: "#f43f5e" }}> *</span>}
          </label>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {Object.keys(OUTCOME_LABELS).map(o => (
              <Pill key={o} color={OUTCOME_COLOR[o] ?? SUPPORT_ACCENT}
                    active={value.outcome === o}
                    onClick={() => onChange({ ...value, outcome: value.outcome === o ? null : o })}>
                {OUTCOME_LABELS[o]}
              </Pill>
            ))}
          </div>
          <div style={hintStyle}>
            This is separate from whether you replied. <strong>Denied</strong> means you
            answered them and said no — that is a real, recordable outcome, not a failure.
          </div>
        </div>
      )}

      {/* ── The action checklist ─────────────────────────────────────────── */}
      <div>
        <label style={labelStyle}>What did you do? Tick everything, including work outside here</label>

        {suggested.length > 0 && (
          <div style={{
            display: "flex", gap: 7, alignItems: "flex-start", marginBottom: "0.6rem",
            background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.22)",
            borderRadius: 9, padding: "0.5rem 0.65rem",
          }}>
            <Sparkles size={12} color="#a78bfa" style={{ marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.55 }}>
              The agent expected{" "}
              {suggested.map(k => defByKey.get(k)?.label ?? k).join(", ")}
              {" "}— marked with a dot below. Tick what actually happened; if the guess was
              wrong, leaving it unticked is the correction.
            </span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          {vocabulary.map(group => (
            <div key={group.group}>
              <div style={{
                fontSize: 9, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase",
                color: "var(--text-dim)", marginBottom: 5,
              }}>{group.group}</div>
              <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                {group.actions.map(a => (
                  <Pill key={a.key}
                        color={a.external ? "#f5a840" : SUPPORT_ACCENT}
                        active={selected.has(a.key)}
                        onClick={() => toggle(a.key)}
                        title={a.external ? `Happens outside Mission Control${a.system ? ` — in ${a.system}` : ""}` : undefined}>
                    {suggested.includes(a.key) && !selected.has(a.key) && (
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#a78bfa" }} />
                    )}
                    {a.external && <ExternalLink size={9} />}
                    {a.label}
                  </Pill>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Detail for each ticked action ────────────────────────────────── */}
      {value.actions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>
            {value.actions.length} action{value.actions.length === 1 ? "" : "s"} — add specifics where they matter
          </label>
          {value.actions.map(a => {
            const def = defByKey.get(a.key);
            return (
              <div key={a.key} style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${a.followup ? "rgba(245,168,64,0.35)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 9, padding: "0.6rem 0.7rem",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800 }}>{def?.label ?? a.key}</span>
                  {def?.external && (
                    <Pill color="#f5a840"><ExternalLink size={9} /> {a.externalSystem ?? "external"}</Pill>
                  )}
                  <span style={{ flex: 1 }} />
                  <Pill color="#f5a840" active={a.followup}
                        onClick={() => patch(a.key, { followup: !a.followup })}
                        title="Not done yet — track it as a follow-up with an owner">
                    <Wrench size={9} /> {a.followup ? "Still to do" : "Done"}
                  </Pill>
                  <span onClick={() => toggle(a.key)}
                        style={{ cursor: "pointer", color: "var(--text-dim)", display: "inline-flex" }}
                        title="Remove">
                    <X size={13} />
                  </span>
                </div>

                <input
                  value={a.detail}
                  onChange={e => patch(a.key, { detail: e.target.value })}
                  placeholder={a.key === "other"
                    ? "Required — what did you do?"
                    : def?.external
                      ? "Optional — amount, row, who you spoke to…"
                      : "Optional — anything the next person would need"}
                  style={inputStyle}
                />

                {a.followup && (
                  <div style={{ display: "flex", gap: "0.4rem", marginTop: 6, flexWrap: "wrap" }}>
                    <input
                      value={a.owner}
                      onChange={e => patch(a.key, { owner: e.target.value })}
                      placeholder="Who owns it? *"
                      style={{ ...inputStyle, flex: "1 1 130px", minWidth: 0,
                               borderColor: a.owner.trim() ? "rgba(255,255,255,0.08)" : "rgba(244,63,94,0.45)" }}
                    />
                    <div style={{ position: "relative", flex: "0 0 150px" }}>
                      <CalendarClock size={11} style={{ position: "absolute", left: 8, top: "50%",
                                                        transform: "translateY(-50%)", color: "var(--text-dim)" }} />
                      <input
                        type="date" value={a.dueAt}
                        onChange={e => patch(a.key, { dueAt: e.target.value })}
                        style={{ ...inputStyle, paddingLeft: "1.6rem" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── The summary ──────────────────────────────────────────────────── */}
      <div>
        <label style={labelStyle}>
          Resolution summary
          {outcomeRequired && <span style={{ color: "#f43f5e" }}> *</span>}
        </label>
        <textarea
          value={value.summary}
          onChange={e => onChange({ ...value, summary: e.target.value })}
          rows={3}
          placeholder="What happened, in a sentence. The next person to open this reads it first — and so does the reflection pass."
          style={{ ...inputStyle, lineHeight: 1.6, resize: "vertical" }}
        />
        {outcomeRequired && (
          <div style={{ fontSize: 10, marginTop: 4,
                        color: value.summary.trim().length >= 15 ? "var(--text-dim)" : "#f5a840" }}>
            {value.summary.trim().length}/15 characters minimum
          </div>
        )}
      </div>
    </div>
  );
}

/** The list of already-recorded actions on a ticket, with a way to tick them off. */
export function ActionLog({ actions, onComplete, busy }: {
  actions: any[];
  onComplete: (id: string) => void;
  busy?: string | null;
}) {
  if (!actions.length) {
    return (
      <div style={{ padding: "1rem", fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
        Nothing recorded yet. If you refunded someone, updated the return sheet or called the
        warehouse, tick it in the close-out form — otherwise the only thing this ticket teaches
        the agent is how the email was worded.
      </div>
    );
  }

  return (
    <>
      {actions.map((a, i) => (
        <div key={a.id} style={{
          padding: "0.6rem 1rem",
          borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
          opacity: a.status === "cancelled" ? 0.45 : 1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, fontWeight: 700,
                           textDecoration: a.status === "cancelled" ? "line-through" : "none" }}>
              {a.label}
            </span>
            {a.is_external && (
              <Pill color="#f5a840"><ExternalLink size={9} /> {a.external_system ?? "external"}</Pill>
            )}
            {a.status === "planned" && (
              <Pill color={a.overdue ? "#f43f5e" : "#f5a840"}>
                <Wrench size={9} /> {a.overdue ? "overdue" : "to do"}
              </Pill>
            )}
            {a.status === "done" && <Pill color="#22c55e">done</Pill>}
          </div>

          {a.detail && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4,
                          lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{a.detail}</div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
              {a.status === "planned"
                ? `${a.owner ?? "unassigned"}${a.due_at ? ` · due ${new Date(a.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`
                : `${a.performed_by ?? "—"}${a.performed_at ? ` · ${new Date(a.performed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`}
            </span>
            <span style={{ flex: 1 }} />
            {a.status === "planned" && (
              <Btn size="sm" variant="outline" color="#22c55e"
                   disabled={busy === a.id} onClick={() => onComplete(a.id)}>
                {busy === a.id ? "…" : "Mark done"}
              </Btn>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

/** The append-only timeline. Reads top-to-bottom, oldest first. */
export function Timeline({ events }: { events: any[] }) {
  if (!events?.length) {
    return (
      <div style={{ padding: "1rem", fontSize: 11.5, color: "var(--text-muted)" }}>
        No events yet. Status changes, outcomes and actions land here as they happen.
      </div>
    );
  }
  const color = (t: string) =>
    t === "send_failed" ? "#f43f5e"
    : t === "outcome_set" ? "#22c55e"
    : t.startsWith("followup") || t === "ops_state_changed" ? "#f5a840"
    : t.startsWith("action") ? SUPPORT_ACCENT
    : "var(--text-dim)";

  return (
    <div style={{ padding: "0.7rem 1rem", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
      {events.map(e => (
        <div key={e.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                         background: color(e.event_type), marginTop: 5 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {e.summary || e.event_type}
            </div>
            <div style={{ fontSize: 9.5, color: "var(--text-dim)", marginTop: 1 }}>
              {new Date(e.created_at).toLocaleString("en-US", {
                month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              {e.created_by ? ` · ${e.created_by}` : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** A free-text follow-up that isn't one of the vocabulary actions. */
export function AddFollowupRow({ onAdd }: { onAdd: (a: ActionDraft) => void }) {
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState("");
  const [owner, setOwner] = React.useState("");
  const [dueAt, setDueAt] = React.useState("");

  if (!open) {
    return (
      <Btn size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Plus size={11} /> Follow-up that isn't on the list
      </Btn>
    );
  }
  return (
    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
      <input value={detail} onChange={e => setDetail(e.target.value)}
             placeholder="What needs doing?" style={{ ...inputStyle, flex: "1 1 180px" }} />
      <input value={owner} onChange={e => setOwner(e.target.value)}
             placeholder="Owner *" style={{ ...inputStyle, flex: "0 0 120px" }} />
      <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)}
             style={{ ...inputStyle, flex: "0 0 140px" }} />
      <Btn size="sm" color={SUPPORT_ACCENT}
           disabled={!detail.trim() || !owner.trim()}
           onClick={() => {
             // Filed under `other` so it still aggregates as "something happened
             // outside the vocabulary" rather than vanishing into free text.
             onAdd({ key: "other", detail: detail.trim(), externalSystem: null,
                     followup: true, owner: owner.trim(), dueAt });
             setDetail(""); setOwner(""); setDueAt(""); setOpen(false);
           }}>
        Add
      </Btn>
      <Btn size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em",
  color: "var(--text-muted)", display: "block", marginBottom: 7,
};

const hintStyle: React.CSSProperties = {
  fontSize: 10.5, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.55,
};

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
  padding: "0.42rem 0.6rem", fontSize: 11.5, color: "var(--text-primary)",
  fontFamily: "inherit", outline: "none",
};
