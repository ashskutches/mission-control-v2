"use client";
/**
 * Marketing → Calendar → Import
 *
 * The one screen where the spreadsheet's mess gets resolved by a human, once.
 *
 * WHY A REVIEW SCREEN AND NOT A BUTTON
 * ------------------------------------
 * The promo tab's dates are free text in six different shapes, and most rows carry
 * no year. A parser will get some of those wrong — that is not a bug to be fixed,
 * it is a property of the input. The choice is whether the wrong ones are visible
 * or silent. So every row shows its ORIGINAL cell text beside what the parser made
 * of it and the dates that projects to, and nothing reaches the plan until somebody
 * has looked.
 *
 * The rows the parser could not date are deliberately not hidden and not dropped:
 * they arrive unchecked, with their raw text, for a human to type dates into.
 */
import React, { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Download, AlertTriangle, Check, Loader2, ArrowLeft, ExternalLink, FileSpreadsheet,
} from "lucide-react";
import { BOT_URL, CARD, LABEL, Panel, EmptyState } from "@/components/MarketingShared";

const ACCENT = "#e98d20";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Anchor { rule: string; [k: string]: unknown }

interface Parsed {
  title: string;
  dateText: string;
  anchor: Anchor;
  recurrence: string;
  confidence: string;
  sourceYear: number | null;
  offer: string | null;
  promoCode: string | null;
  discountNote: string | null;
  style: string | null;
  season: string | null;
  angle: string | null;
  skipReason: string | null;
}

interface PreviewRow {
  rowIndex: number;
  importId: string | null;
  raw: Record<string, string>;
  rawDate: string;
  parsed: Parsed | null;
  parseError: string | null;
  projected: { startDate: string | null; endDate: string | null; crossesYearEnd: boolean } | null;
  dedupeKey: string | null;
  suggestInclude: boolean;
}

interface Collision { key: string; rowIndexes: number[]; title: string; note: string }

interface Preview {
  batchId: string;
  year: number;
  model: string;
  fetchedAt: string;
  counts: { rows: number; parsed: number; failed: number; undated: number; skipSite: number; collisions: number };
  collisions: Collision[];
  rows: PreviewRow[];
}

/** Per-row human edits, applied over the stored parse at import time. */
interface Edit { startDate?: string; endDate?: string; title?: string; offer?: string }

// ── Chrome ────────────────────────────────────────────────────────────────────

const btn = (primary = false): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: "0.4rem",
  background: primary ? `${ACCENT}18` : "rgba(255,255,255,0.04)",
  border: `1px solid ${primary ? `${ACCENT}40` : "rgba(255,255,255,0.08)"}`,
  color: primary ? ACCENT : "#94a3b8",
  borderRadius: 8, padding: "0.4rem 0.8rem",
  fontSize: 11.5, fontWeight: 700, cursor: "pointer", textDecoration: "none",
});

const input: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 6, padding: "0.25rem 0.45rem", color: "#e2e8f0", fontSize: 11,
  outline: "none", width: "100%",
};

function describeAnchor(a: Anchor | undefined): string {
  if (!a) return "—";
  switch (a.rule) {
    case "fixed":   return `same days every year (${a.startMonth}/${a.startDay} – ${a.endMonth}/${a.endDay})`;
    case "holiday": return `hung off ${String(a.holiday).replace(/_/g, " ")}` +
      (a.leadDays || a.trailDays ? ` (−${a.leadDays}d / +${a.trailDays}d)` : "");
    case "month":   return `the whole of month ${a.month}`;
    default:        return "could not be read — set the dates yourself";
  }
}

const CONF_COLOR: Record<string, string> = {
  exact: "#4ade80", inferred: "#eab308", ambiguous: "#f43f5e",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CalendarImportPage() {
  const currentYear = new Date().getFullYear();

  const [year, setYear]       = useState(currentYear);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [done, setDone]       = useState<string | null>(null);

  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [edits, setEdits]       = useState<Record<number, Edit>>({});

  const read = useCallback(async () => {
    setReading(true); setError(null); setDone(null); setPreview(null);
    try {
      const r = await fetch(`${BOT_URL}/admin/marketing-calendar/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setPreview(d);
      setIncluded(new Set(d.rows.filter((x: PreviewRow) => x.suggestInclude).map((x: PreviewRow) => x.rowIndex)));
      setEdits({});
    } catch (e: any) {
      setError(e?.message ?? "Could not read the sheet.");
    } finally { setReading(false); }
  }, [year]);

  const runImport = useCallback(async () => {
    if (!preview) return;
    setImporting(true); setError(null);
    try {
      const rows = [...included].map(rowIndex => {
        const e = edits[rowIndex] ?? {};
        const overrides: Record<string, unknown> = {};
        if (e.startDate) overrides.startDate = e.startDate;
        if (e.endDate)   overrides.endDate   = e.endDate;
        if (e.title)     overrides.title     = e.title;
        if (e.offer)     overrides.offer     = e.offer;
        return { rowIndex, overrides };
      });

      const r = await fetch(`${BOT_URL}/admin/marketing-calendar/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: preview.batchId, year, rows }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);

      const skipped = d.skipped ? ` ${d.skipped} marked "not on site" from the sheet's own note.` : "";
      const rejected = d.rejected?.length ? ` ${d.rejected.length} could not be imported.` : "";
      setDone(`Imported ${d.imported} sales into the ${year} plan.${skipped}${rejected}`);
    } catch (e: any) {
      setError(e?.message ?? "Import failed.");
    } finally { setImporting(false); }
  }, [preview, included, edits, year]);

  const toggle = (i: number) =>
    setIncluded(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const edit = (i: number, patch: Edit) =>
    setEdits(prev => ({ ...prev, [i]: { ...prev[i], ...patch } }));

  const undatedSelected = useMemo(
    () => (preview?.rows ?? []).filter(r =>
      included.has(r.rowIndex) &&
      !r.projected?.startDate &&
      !edits[r.rowIndex]?.startDate).length,
    [preview, included, edits],
  );

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <Link href="/marketing/calendar" style={{ ...btn(), textDecoration: "none" }}>
          <ArrowLeft size={12} /> Back to the calendar
        </Link>
        <a href="https://docs.google.com/spreadsheets/d/1O9RVN6B-1VcBAh1CNdus5fgqBRhU1pIW-aRSLE_EKk0/edit"
          target="_blank" rel="noreferrer" style={btn()}>
          <FileSpreadsheet size={12} /> Open the sheet <ExternalLink size={10} />
        </a>
      </div>

      <Panel
        title="Import the marketing calendar"
        note={
          "Reads the PROMO tab, parses each row, and shows what it would become. Nothing is " +
          "saved to the plan until you press Import. The sheet is never written to."
        }
      >
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ ...LABEL, display: "block", marginBottom: "0.3rem" }}>Plan year</label>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {[currentYear, currentYear + 1].map(y => (
                <button key={y} onClick={() => setYear(y)} style={{ ...btn(y === year), padding: "0.3rem 0.7rem" }}>
                  {y}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => void read()} disabled={reading} style={btn(true)}>
            {reading ? <Loader2 size={12} className="spin" /> : <Download size={12} />}
            {reading ? "Reading and parsing — this takes a few minutes…" : "Read the sheet"}
          </button>
        </div>

        <p style={{ fontSize: 10.5, color: "#475569", marginTop: "0.75rem", lineHeight: 1.6 }}>
          The sheet is an annual template, not a forward schedule — its promo tab runs to
          February 2026 and stops. Rows are projected onto <strong>{year}</strong>, with
          floating holidays recomputed rather than shifted, so Black Friday lands on a Friday.
        </p>
      </Panel>

      {error && (
        <div style={{ ...CARD, marginBottom: "1rem", borderColor: "rgba(244,63,94,0.3)" }}>
          <p style={{ fontSize: 12, color: "#f43f5e", lineHeight: 1.6 }}>{error}</p>
        </div>
      )}

      {done && (
        <div style={{ ...CARD, marginBottom: "1rem", borderColor: "rgba(74,222,128,0.3)" }}>
          <p style={{ fontSize: 12.5, color: "#4ade80", marginBottom: "0.6rem" }}>
            <Check size={12} style={{ display: "inline", marginRight: 4 }} /> {done}
          </p>
          <Link href="/marketing/calendar" style={btn(true)}>Open the calendar</Link>
        </div>
      )}

      {preview && (
        <>
          <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            {[
              { label: "Rows read", value: preview.counts.rows },
              { label: "Parsed", value: preview.counts.parsed },
              { label: "Failed", value: preview.counts.failed, warn: true },
              { label: "No dates", value: preview.counts.undated, warn: true },
              { label: "Not on site", value: preview.counts.skipSite },
              { label: "Same name", value: preview.counts.collisions ?? 0, warn: true },
              { label: "Selected", value: included.size },
            ].map(s => (
              <div key={s.label}>
                <p style={{ fontSize: 18, fontWeight: 800, color: s.warn && s.value ? "#eab308" : "#e2e8f0" }}>{s.value}</p>
                <p style={{ ...LABEL, fontSize: 9.5 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {undatedSelected > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <EmptyState reason={
                `${undatedSelected} selected row${undatedSelected === 1 ? " has" : "s have"} no dates. ` +
                `They will import as undated entries you can fix on the calendar, or you can type ` +
                `the dates in below now.`
              } />
            </div>
          )}

          {!!preview.collisions?.length && (
            <div style={{
              ...CARD, marginBottom: "1rem",
              background: "rgba(244,63,94,0.06)", borderColor: "rgba(244,63,94,0.28)",
            }}>
              <p style={{ fontSize: 12.5, fontWeight: 800, color: "#f43f5e", marginBottom: "0.35rem" }}>
                <AlertTriangle size={12} style={{ display: "inline", marginRight: 4 }} />
                {preview.collisions.length} name{preview.collisions.length === 1 ? "" : "s"} used by more than one row
              </p>
              <p style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.6, marginBottom: "0.5rem" }}>
                A sale is keyed by its name and year, so two rows with the same name become
                <strong> one </strong> sale — the last one imported wins and the other disappears
                without an error. Rename the ones that are genuinely different, or untick the
                duplicates. Rows that really are one sale written across several days (the
                five-day event) are fine to leave.
              </p>
              {preview.collisions.map(c => (
                <p key={c.key} style={{ fontSize: 11.5, color: "#cbd5e1", lineHeight: 1.7 }}>
                  • <strong>{c.title}</strong> — sheet rows {c.rowIndexes.join(", ")}
                </p>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gap: "0.6rem", marginBottom: "1.25rem" }}>
            {preview.rows.map(row => {
              const on = included.has(row.rowIndex);
              const e  = edits[row.rowIndex] ?? {};
              const conf = row.parsed?.confidence ?? "ambiguous";

              return (
                <div key={row.rowIndex} style={{
                  ...CARD, padding: "0.8rem",
                  opacity: on ? 1 : 0.5,
                  borderColor: on ? `${ACCENT}25` : "rgba(255,255,255,0.06)",
                }}>
                  <div style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start" }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(row.rowIndex)}
                      style={{ marginTop: 3, accentColor: ACCENT, flexShrink: 0 }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* What the sheet actually says — the evidence, first. */}
                      <p style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Sheet row {row.rowIndex}
                      </p>
                      <p style={{ fontSize: 11.5, color: "#64748b", fontFamily: "monospace", marginBottom: "0.5rem" }}>
                        “{row.rawDate || "—"}”
                      </p>

                      {row.parseError ? (
                        <p style={{ fontSize: 11.5, color: "#f43f5e", lineHeight: 1.6 }}>
                          <AlertTriangle size={11} style={{ display: "inline", marginRight: 4 }} />
                          Could not parse: {row.parseError}
                        </p>
                      ) : (
                        <>
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}>
                            {/* Editable, because renaming is how a human splits two sales
                                the sheet gave the same name — the dedupe key follows the title. */}
                            <input
                              value={e.title ?? row.parsed?.title ?? ""}
                              onChange={ev => edit(row.rowIndex, { title: ev.target.value })}
                              style={{
                                ...input, width: "auto", minWidth: 220,
                                fontSize: 13, fontWeight: 800, color: "#e2e8f0",
                                background: "transparent", border: "1px solid transparent",
                                padding: "0.1rem 0.2rem",
                              }}
                            />
                            <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", color: CONF_COLOR[conf] }}>
                              {conf}
                            </span>
                            {row.parsed?.skipReason && (
                              <span style={{ fontSize: 10, color: "#eab308" }}>
                                not a website promotion — {row.parsed.skipReason}
                              </span>
                            )}
                          </div>

                          <p style={{ fontSize: 11, color: "#64748b", marginBottom: "0.5rem" }}>
                            {row.parsed?.offer ?? "no offer"}
                            {row.parsed?.promoCode ? ` · ${row.parsed.promoCode}` : ""}
                            {" · "}{describeAnchor(row.parsed?.anchor)}
                          </p>

                          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ minWidth: 130 }}>
                              <label style={{ ...LABEL, fontSize: 9, display: "block", marginBottom: 2 }}>
                                Starts in {year}
                              </label>
                              <input
                                type="date" style={input}
                                value={e.startDate ?? row.projected?.startDate ?? ""}
                                onChange={ev => edit(row.rowIndex, { startDate: ev.target.value })}
                              />
                            </div>
                            <div style={{ minWidth: 130 }}>
                              <label style={{ ...LABEL, fontSize: 9, display: "block", marginBottom: 2 }}>Ends</label>
                              <input
                                type="date" style={input}
                                value={e.endDate ?? row.projected?.endDate ?? ""}
                                onChange={ev => edit(row.rowIndex, { endDate: ev.target.value })}
                              />
                            </div>
                            {row.projected?.crossesYearEnd && (
                              <span style={{ fontSize: 10, color: "#eab308" }}>runs into {year + 1}</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            position: "sticky", bottom: 0, background: "rgba(2,6,23,0.92)",
            backdropFilter: "blur(8px)", padding: "0.85rem 0",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap",
          }}>
            <button onClick={() => void runImport()} disabled={importing || !included.size} style={btn(true)}>
              {importing ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
              Import {included.size} sale{included.size === 1 ? "" : "s"} into {year}
            </button>
            <p style={{ fontSize: 10.5, color: "#475569", lineHeight: 1.5 }}>
              Re-importing updates what the sheet owns and leaves status, notes and studio runs alone.
            </p>
          </div>
        </>
      )}

      <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
