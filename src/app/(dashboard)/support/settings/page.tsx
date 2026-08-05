"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Mail, Send, Download, ShieldAlert, Save, Calculator, CheckCircle2, PenLine, User, Users } from "lucide-react";
import { Panel, Pill, Btn, SUPPORT_ACCENT, Loading, ErrorBox } from "../ui";
import { getSettings, saveSettings, saveAssumption, getMailboxes, saveSignature } from "../api";

const ASSUMPTION_META: Record<string, { label: string; unit: string; help: string }> = {
  baseline_minutes_per_reply: {
    label: "Baseline minutes per reply", unit: "minutes",
    help: "How long a person takes to write one reply from scratch. MEASURE this — time 20 real replies. A guess here makes every money figure a guess.",
  },
  loaded_hourly_rate: {
    label: "Loaded hourly rate", unit: "$/hour",
    help: "Fully-loaded cost of a support hour, including overhead — not the wage.",
  },
  escalation_cost: {
    label: "Escalation cost", unit: "$",
    help: "Marginal cost when a ticket reaches a second person.",
  },
};

export default function SupportSettings() {
  const [s, setS] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [mailQuery, setMailQuery] = useState("");
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [sig, setSig] = useState<any>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [d, boxes] = await Promise.all([
        getSettings(),
        // A missing mailbox list shouldn't blank the whole page — the rest of
        // settings still works without it.
        getMailboxes().catch(() => []),
      ]);
      setS(d);
      setAgentId(d.mail?.agentId ?? "");
      setMailQuery(d.mail?.mailQuery ?? "");
      setMailboxes(boxes);
      setSig(d.signature ?? null);
    } catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (patch: any, msg: string) => {
    setBusy(true); setErr(null); setNote(null);
    try { await saveSettings(patch); setNote(msg); await load(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (err && !s) return <ErrorBox error={err} onRetry={load} />;
  if (!s) return <Loading label="Loading settings" />;

  const mail = s.mail ?? {};

  return (
    <>
      {err && <ErrorBox error={err} />}
      {note && (
        <div style={{ display: "flex", alignItems: "center", gap: 8,
                      background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)",
                      borderRadius: 10, padding: "0.6rem 0.9rem", marginBottom: "1rem" }}>
          <CheckCircle2 size={15} color="#22c55e" />
          <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>{note}</span>
        </div>
      )}

      <div style={{ display: "grid", gap: "0.9rem",
                    gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", alignItems: "start" }}>

        <Panel title="Mailbox" subtitle={`Adapter: ${mail.adapter ?? "—"}`}>
          <div style={{
            display: "flex", gap: 8, alignItems: "flex-start",
            background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.25)",
            borderRadius: 9, padding: "0.65rem 0.8rem", marginBottom: "1rem",
          }}>
            <ShieldAlert size={14} color="#f43f5e" style={{ marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 11, lineHeight: 1.6, color: "var(--text-secondary)" }}>
              <strong>Both switches are off by default and that is deliberate.</strong> Until sending
              is enabled, approved replies are recorded but never leave the building. Turn it on only
              once you have confirmed which mailbox this is pointed at — everything it sends goes to
              a real customer.
            </span>
          </div>

          <label style={label}>Mailbox</label>
          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem" }}>
            <select
              value={agentId} onChange={e => setAgentId(e.target.value)}
              style={{ ...input, cursor: "pointer" }}
            >
              <option value="">— none selected —</option>
              {mailboxes.map(m => (
                <option key={m.agentId} value={m.agentId}>
                  {m.email} — {m.name}{m.orphaned ? " (agent deleted)" : ""}
                </option>
              ))}
            </select>
            <Btn size="sm" color={SUPPORT_ACCENT} disabled={busy || agentId === (mail.agentId ?? "")}
                 onClick={() => save({ mailAgentId: agentId }, "Mailbox updated.")}>
              <Save size={11} /> Save
            </Btn>
          </div>

          {mailboxes.length === 0 ? (
            <div style={{ fontSize: 10.5, color: "#f5a840", lineHeight: 1.55, marginBottom: "1.1rem" }}>
              No Google accounts are connected to any agent yet. Connect one under
              Agents → Email, then come back — Support reuses that same per-agent OAuth.
            </div>
          ) : (
            <div style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.55, marginBottom: "1.1rem" }}>
              {mailboxes.length} connected account{mailboxes.length === 1 ? "" : "s"}, listed by address.
              Several agents can share one address — picking any of them polls that inbox.
            </div>
          )}

          {/* Most of the connected accounts point at info@, which is a general
              inbox. Without a scope, every supplier email and marketing reply
              becomes a support ticket with a drafted response waiting on you. */}
          <label style={label}>Scope filter (Gmail search)</label>
          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem" }}>
            <input
              value={mailQuery} onChange={e => setMailQuery(e.target.value)}
              placeholder='e.g. to:support@leapsandrebounds.com   or   label:support'
              style={input}
            />
            <Btn size="sm" variant="outline" color={SUPPORT_ACCENT}
                 disabled={busy || mailQuery === (mail.mailQuery ?? "")}
                 onClick={() => save({ mailQuery }, "Scope filter updated.")}>
              <Save size={11} /> Save
            </Btn>
          </div>
          <div style={{
            fontSize: 10.5, lineHeight: 1.55, marginBottom: "1.1rem",
            color: mailQuery.trim() ? "var(--text-muted)" : "#f5a840",
          }}>
            {mailQuery.trim()
              ? "ANDed onto the poll. Only matching mail becomes a ticket."
              : "Empty means every message in the inbox becomes a ticket — only right for an "
                + "address that receives nothing but support. On a shared inbox like info@, set one."}
          </div>

          <Toggle
            icon={Download} label="Ingestion" on={!!mail.ingestEnabled}
            desc="Poll the mailbox, create tickets, classify and draft."
            onClick={() => save({ ingestEnabled: !mail.ingestEnabled },
              mail.ingestEnabled ? "Ingestion disabled." : "Ingestion enabled.")}
            disabled={busy || !mail.agentId}
          />
          <Toggle
            icon={Send} label="Sending" on={!!mail.sendEnabled} danger
            desc="Allow approved replies to actually be emailed to customers."
            onClick={() => save({ sendEnabled: !mail.sendEnabled },
              mail.sendEnabled ? "Sending disabled." : "Sending ENABLED — replies will now reach customers.")}
            disabled={busy || !mail.agentId}
          />

          {mail.blockers?.length > 0 && (
            <div style={{ marginTop: "1rem", paddingTop: "0.8rem",
                          borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                            letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6 }}>
                Currently blocking
              </div>
              <ul style={{ margin: 0, paddingLeft: "1rem" }}>
                {mail.blockers.map((b: string, i: number) => (
                  <li key={i} style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6 }}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <SignaturePanel sig={sig} setSig={setSig} busy={busy} setBusy={setBusy}
                        onSaved={(m: string) => { setNote(m); load(); }} onError={setErr} />

        <Panel title="Money assumptions"
               subtitle="Every figure needs a basis — a dollar number with no stated calculation is decoration">
          <div style={{ display: "grid", gap: "0.9rem" }}>
            {Object.entries(ASSUMPTION_META).map(([key, m]) => (
              <AssumptionRow key={key} k={key} meta={m} current={s.assumptions?.[key]}
                             onSaved={(msg) => { setNote(msg); load(); }} onError={setErr} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 7, alignItems: "flex-start", marginTop: "1rem",
                        fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
            <Calculator size={12} style={{ marginTop: 1, flexShrink: 0 }} />
            While these are 0, the dashboard reports money as “not calculable” and says which
            assumption is missing — rather than showing $0, which would read as “we saved nothing”.
          </div>
        </Panel>
      </div>
    </>
  );
}

/**
 * The signature is a setting, not a document.
 *
 * It used to be a doc, and six reply scripts each carried their own sign-off that
 * contradicted it — the model was handed two signatures and picked one. Now the
 * model is told not to sign off at all and this exact block is appended to every
 * draft, so there is one place it can differ.
 */
function SignaturePanel({ sig, setSig, busy, setBusy, onSaved, onError }: any) {
  if (!sig) return null;

  const set = (k: string, v: any) => setSig({ ...sig, [k]: v });

  const preview = (() => {
    if (!sig.enabled) return "(no signature — replies end wherever the agent stops)";
    const out = [sig.closing?.trim() || "", ""];
    if (sig.mode === "person") {
      out.push(sig.name?.trim() || "");
      if (sig.role?.trim()) out.push(sig.role.trim());
      if (sig.company?.trim()) out.push(sig.company.trim());
    } else {
      out.push(sig.teamName?.trim() || "");
    }
    if (sig.email?.trim()) out.push(sig.email.trim());
    return out.filter((l, i) => !(l === "" && i === out.length - 1)).join("\n");
  })();

  return (
    <Panel
      title="Email signature"
      subtitle="Appended to every draft automatically — the agent is told not to write one"
      right={
        <Btn size="sm" color={SUPPORT_ACCENT} disabled={busy}
             onClick={async () => {
               setBusy(true);
               try { await saveSignature(sig); onSaved("Signature saved — it applies from the next draft."); }
               catch (e: any) { onError(e.message); }
               finally { setBusy(false); }
             }}>
          <Save size={11} /> Save
        </Btn>
      }
    >
      <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.9rem", flexWrap: "wrap" }}>
        <Pill color={SUPPORT_ACCENT} active={sig.enabled} onClick={() => set("enabled", !sig.enabled)}>
          {sig.enabled ? "On" : "Off"}
        </Pill>
        <Pill color="#a78bfa" active={sig.mode === "person"} onClick={() => set("mode", "person")}>
          <User size={9} /> Named person
        </Pill>
        <Pill color="#4a9eff" active={sig.mode === "team"} onClick={() => set("mode", "team")}>
          <Users size={9} /> The team
        </Pill>
      </div>

      {sig.enabled && (
        <>
          <div style={{ display: "grid", gap: "0.5rem", marginBottom: "0.9rem",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Field label="Closing" value={sig.closing} onChange={(v: string) => set("closing", v)} />
            {sig.mode === "person" ? (
              <>
                <Field label="Name" value={sig.name} onChange={(v: string) => set("name", v)} />
                <Field label="Role" value={sig.role} onChange={(v: string) => set("role", v)} />
                <Field label="Company" value={sig.company} onChange={(v: string) => set("company", v)} />
              </>
            ) : (
              <Field label="Team name" value={sig.teamName} onChange={(v: string) => set("teamName", v)} />
            )}
            <Field label="Reply-to address" value={sig.email} onChange={(v: string) => set("email", v)} />
          </div>

          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                        letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6 }}>
            Every reply ends like this
          </div>
          <pre style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 9, padding: "0.8rem 0.9rem", margin: 0,
            fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)",
            fontFamily: "inherit", whiteSpace: "pre-wrap",
          }}>{preview}</pre>
        </>
      )}

      <div style={{ display: "flex", gap: 7, alignItems: "flex-start", marginTop: "0.9rem",
                    fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
        <PenLine size={12} style={{ marginTop: 1, flexShrink: 0 }} />
        {sig.mode === "person"
          ? "A named person implies someone read the email. That's a promise worth keeping — it's also what was being sent before this became a setting."
          : "Signing as the team is honest about an AI-drafted reply, and needs no real person to stand behind it."}
      </div>
    </Panel>
  );
}

function Field({ label: text, value, onChange }: any) {
  return (
    <div>
      <label style={label}>{text}</label>
      <input value={value ?? ""} onChange={e => onChange(e.target.value)} style={input} />
    </div>
  );
}

function Toggle({ icon: Icon, label: text, desc, on, onClick, disabled, danger }: any) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "0.65rem 0.75rem",
      background: on ? (danger ? "rgba(244,63,94,0.07)" : "rgba(34,197,94,0.06)") : "rgba(255,255,255,0.025)",
      border: `1px solid ${on ? (danger ? "rgba(244,63,94,0.3)" : "rgba(34,197,94,0.25)") : "rgba(255,255,255,0.06)"}`,
      borderRadius: 9, marginBottom: "0.5rem",
    }}>
      <Icon size={14} color={on ? (danger ? "#f43f5e" : "#22c55e") : "var(--text-dim)"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>{text}</div>
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>{desc}</div>
      </div>
      <Pill color={on ? (danger ? "#f43f5e" : "#22c55e") : "#6b7280"} solid={on}>{on ? "On" : "Off"}</Pill>
      <Btn size="sm" variant="ghost" onClick={onClick} disabled={disabled}>
        {on ? "Turn off" : "Turn on"}
      </Btn>
    </div>
  );
}

function AssumptionRow({ k, meta, current, onSaved, onError }: any) {
  const [value, setValue] = useState(String(current?.value ?? 0));
  const [basis, setBasis] = useState(current?.basis ?? "");
  const [busy, setBusy] = useState(false);
  const unset = !Number(current?.value);

  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: `1px solid ${unset ? "rgba(245,168,64,0.28)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 9, padding: "0.7rem 0.8rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{meta.label}</span>
        <span style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{meta.unit}</span>
        {unset && <Pill color="#f5a840" solid>not set</Pill>}
      </div>
      <div style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.55, marginBottom: 8 }}>
        {meta.help}
      </div>
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem" }}>
        <input value={value} onChange={e => setValue(e.target.value)} type="number"
               style={{ ...input, maxWidth: 110 }} />
        <input value={basis} onChange={e => setBasis(e.target.value)}
               placeholder="Where this number came from (required)" style={input} />
      </div>
      <Btn size="sm" variant="outline" color={SUPPORT_ACCENT}
           disabled={busy || !basis.trim() || !Number.isFinite(Number(value))}
           onClick={async () => {
             setBusy(true);
             try {
               await saveAssumption({ key: k, value: Number(value), basis, unit: meta.unit });
               onSaved(`${meta.label} saved.`);
             } catch (e: any) { onError(e.message); }
             finally { setBusy(false); }
           }}>
        <Save size={11} /> Save
      </Btn>
    </div>
  );
}

const label: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em",
  color: "var(--text-muted)", display: "block", marginBottom: 6,
};

const input: React.CSSProperties = {
  flex: 1, minWidth: 0, background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
  padding: "0.4rem 0.6rem", fontSize: 11.5,
  color: "var(--text-primary)", fontFamily: "inherit", outline: "none",
};
