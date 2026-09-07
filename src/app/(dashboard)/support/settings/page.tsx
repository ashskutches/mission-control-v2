"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Mail, Send, Download, ShieldAlert, Save, Calculator, CheckCircle2, PenLine, User, Users } from "lucide-react";
import { Panel, Pill, Btn, SUPPORT_ACCENT, Loading, ErrorBox } from "../ui";
import { getSettings, saveSettings, saveAssumption, getMailboxes, saveSignature } from "../api";

/**
 * How often to check, offered as named choices rather than a number box.
 *
 * Hourly is the default and the recommendation. Faster does not cost more in
 * total — the same emails get classified and drafted either way — but it does
 * mean a half-written thread gets a draft before the customer has finished
 * sending follow-ups, and it puts the queue in front of someone constantly.
 * Slower than four hours starts to feel like the tool is ignoring people.
 */
const POLL_CHOICES = [
  { minutes: 15,   label: "Every 15 minutes" },
  { minutes: 30,   label: "Every 30 minutes" },
  { minutes: 60,   label: "Once an hour (recommended)" },
  { minutes: 240,  label: "Every 4 hours" },
  { minutes: 1440, label: "Once a day" },
];

const POLL_LABEL: Record<number, string> = {
  15: "every 15 minutes", 30: "every 30 minutes", 60: "once an hour",
  240: "every 4 hours", 1440: "once a day",
};

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
  const [mailExclude, setMailExclude] = useState("");
  const [pollMinutes, setPollMinutes] = useState(60);
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
      setMailExclude(d.mail?.mailExclude ?? "");
      setPollMinutes(d.mail?.pollMinutes ?? 60);
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

        <Panel title="Email" subtitle="Which inbox we watch, and how often">
          <div style={{
            display: "flex", gap: 8, alignItems: "flex-start",
            background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.25)",
            borderRadius: 9, padding: "0.65rem 0.8rem", marginBottom: "1rem",
          }}>
            <ShieldAlert size={14} color="#f43f5e" style={{ marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 11, lineHeight: 1.6, color: "var(--text-secondary)" }}>
              <strong>Nothing is emailed to a customer until a person approves it</strong> — and, while
              the last switch below is off, not even then. Turn that one on only once you have read a
              few drafts and are happy with them. Everything it sends goes to a real customer.
            </span>
          </div>

          <label style={label}>Which mailbox</label>
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
              No Google account is connected yet, so there is no inbox to watch. Someone needs to
              connect one under Agents → Email first, then come back here and pick it.
            </div>
          ) : (
            <div style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.55, marginBottom: "1.1rem" }}>
              {mailboxes.length} connected account{mailboxes.length === 1 ? "" : "s"}. This is the inbox
              customer emails arrive in — usually info@leapsandrebounds.com. If the same address is
              listed twice, either one works.
            </div>
          )}

          {/* Cadence is a setting rather than a cron expression because the people
              who need to change it cannot deploy. Named choices rather than a
              number box: "how often" has maybe four sensible answers and a free
              number invites "1", which is the same cost as hourly concentrated
              into whoever is watching. */}
          <label style={label}>How often to check for new email</label>
          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem" }}>
            <select
              value={String(pollMinutes)}
              onChange={e => {
                const next = Number(e.target.value);
                setPollMinutes(next);
                save({ pollMinutes: next }, `We'll now check for new email ${POLL_LABEL[next] ?? `every ${next} minutes`}.`);
              }}
              style={{ ...input, cursor: "pointer" }}
              disabled={busy}
            >
              {POLL_CHOICES.map(c => (
                <option key={c.minutes} value={c.minutes}>{c.label}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 10.5, lineHeight: 1.55, marginBottom: "1.1rem",
                        color: "var(--text-muted)" }}>
            You can always press <strong>Check mail</strong> on the Inbox to look right now, whatever
            this is set to. Checking more often does not cost more overall — the same emails get
            handled either way — it just spreads the work out.
          </div>

          {/* The noise on a general inbox is handled by the exclusion list below,
              which fails in the harmless direction. This field is the opposite —
              it names what to KEEP, so anything it does not name is dropped
              silently, including real customers who wrote to another address. */}
          <label style={label}>Only pick up certain emails — usually leave empty</label>
          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem" }}>
            <input
              value={mailQuery} onChange={e => setMailQuery(e.target.value)}
              placeholder="empty = ingest everything the exclusions below allow"
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
            color: mailQuery.trim() ? "#f5a840" : "var(--text-muted)",
          }}>
            {mailQuery.trim()
              ? "⚠ Right now we ONLY pick up emails matching this. Everything else is ignored and "
                + "never shows up here — including customers who wrote to a different address, were "
                + "CC'd into a thread, or used the contact form on the website. Clear this box "
                + "unless you specifically meant to do that."
              : "Leave this empty. It means we pick up everything except the senders listed below, "
                + "which is what you want on a shared inbox."}
          </div>

          {/* The list the build plan called for and that never got built. */}
          <label style={label}>Senders to ignore</label>
          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem" }}>
            <input
              value={mailExclude} onChange={e => setMailExclude(e.target.value)}
              placeholder="-from:noreply@ -from:klaviyo.com …"
              style={input}
            />
            <Btn size="sm" variant="outline" color={SUPPORT_ACCENT}
                 disabled={busy || mailExclude === (mail.mailExclude ?? "")}
                 onClick={() => save({ mailExclude }, "Exclusions updated.")}>
              <Save size={11} /> Save
            </Btn>
          </div>
          <div style={{ fontSize: 10.5, lineHeight: 1.55, marginBottom: "1.1rem",
                        color: "var(--text-muted)" }}>
            Keeps automatic email out of your queue — order confirmations, Klaviyo, Shopify, "do not
            reply" addresses. This is the safe way to quieten a shared inbox: the worst that happens
            is a supplier email you delete in two seconds, instead of a customer nobody ever sees.
            The defaults are already sensible; you probably never need to touch this.
          </div>

          <Toggle
            icon={Download} label="Check for new email" on={!!mail.ingestEnabled}
            desc="Read the inbox, turn customer emails into tickets, and write a suggested reply for each one."
            onClick={() => save({ ingestEnabled: !mail.ingestEnabled },
              mail.ingestEnabled
                ? "We'll stop checking for new email. Nothing new will appear in the Inbox."
                : "We'll now check for new email automatically.")}
            disabled={busy || !mail.agentId}
          />
          <Toggle
            icon={Send} label="Send replies to customers" on={!!mail.sendEnabled} danger
            desc="When someone approves a reply here, actually email it. With this off, approved replies are saved but never sent."
            onClick={() => save({ sendEnabled: !mail.sendEnabled },
              mail.sendEnabled
                ? "Replies will no longer be emailed. Anything you approve will sit here undelivered."
                : "Replies you approve will now be emailed to real customers.")}
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
