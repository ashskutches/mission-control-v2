"use client";
/**
 * Marketing → Calendar
 *
 * The company sales calendar, as a plan rather than a spreadsheet.
 *
 * WHY THIS PAGE EXISTS AT ALL
 * ---------------------------
 * The calendar lived in a Google Sheet nine people edit, whose promo tab runs
 * Nov 2024 → Feb 2026 and stops. Read as a schedule it does not work: the dates
 * are free text, most rows carry no year, and half the sales float. So the sheet
 * is imported once, a human fixes what the parser could not, and from then on the
 * plan lives here and rolls itself forward.
 *
 * WHY OVERLAPS ARE THE LOUDEST THING ON THE SCREEN
 * ------------------------------------------------
 * `top-bar.liquid` and `hero-lifestyle.liquid` both walk the Shopify calendar,
 * take the FIRST event whose range contains now, and break. Two overlapping sales
 * is not an error — the second one silently never renders, decided by position in
 * a list nobody thinks of as ordered. A planner that lets two sales overlap has
 * already chosen which one goes dark. So the warning is a banner, not a footnote.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  CalendarDays, AlertTriangle, Download, RefreshCw, Sparkles, ChevronRight,
  Clock, Check, Loader2, ExternalLink, ArrowRightCircle,
} from "lucide-react";
import { BOT_URL, CARD, LABEL, Panel, EmptyState } from "@/components/MarketingShared";

const ACCENT = "#e98d20";

// ── Types ─────────────────────────────────────────────────────────────────────

type PlanStatus = "planned" | "briefed" | "assets_ready" | "approved" | "live" | "done" | "skipped";

interface PlanRow {
  id: string;
  plan_year: number;
  title: string;
  start_date: string | null;
  end_date: string | null;
  recurrence: string;
  date_confidence: string;
  offer: string | null;
  promo_code: string | null;
  discount_note: string | null;
  style: string | null;
  season: string | null;
  angle: string | null;
  status: PlanStatus;
  source_year: number | null;
  source_date_text: string | null;
  studio_job_ids: string[];
  notes: string | null;
  channel_notes: Record<string, string>;
}

interface Overlap {
  a: { id: string; title: string }; b: { id: string; title: string }; days: number;
}

interface PlanResponse {
  year: number;
  rows: PlanRow[];
  overlaps: Overlap[];
  counts: { total: number; undated: number; upcoming: number; unready: number };
}

// ── Chrome ────────────────────────────────────────────────────────────────────

const STATUS: Record<PlanStatus, { label: string; color: string }> = {
  planned:      { label: "Planned",      color: "#64748b" },
  briefed:      { label: "Briefed",      color: "#818cf8" },
  assets_ready: { label: "Assets ready", color: ACCENT },
  approved:     { label: "Approved",     color: "#38bdf8" },
  live:         { label: "Live",         color: "#4ade80" },
  done:         { label: "Done",         color: "#334155" },
  skipped:      { label: "Not on site",  color: "#475569" },
};

const STATUS_ORDER: PlanStatus[] = [
  "planned", "briefed", "assets_ready", "approved", "live", "done", "skipped",
];

function StatusPill({ status }: { status: PlanStatus }) {
  const s = STATUS[status] ?? STATUS.planned;
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
      color: s.color, background: `${s.color}18`, border: `1px solid ${s.color}33`,
      borderRadius: 999, padding: "0.15rem 0.5rem", whiteSpace: "nowrap",
    }}>{s.label}</span>
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

/** `2026-10-10` → `Oct 10`. Parsed as UTC — these are dates, not instants. */
function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]!.slice(0, 3)} ${d}`;
}

function range(row: PlanRow): string {
  if (!row.start_date) return "no dates";
  if (!row.end_date || row.end_date === row.start_date) return shortDate(row.start_date);
  return `${shortDate(row.start_date)} – ${shortDate(row.end_date)}`;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((Date.parse(iso) - Date.parse(today)) / 86_400_000);
}

const btn = (primary = false): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: "0.4rem",
  background: primary ? `${ACCENT}18` : "rgba(255,255,255,0.04)",
  border: `1px solid ${primary ? `${ACCENT}40` : "rgba(255,255,255,0.08)"}`,
  color: primary ? ACCENT : "#94a3b8",
  borderRadius: 8, padding: "0.35rem 0.75rem",
  fontSize: 11, fontWeight: 700, cursor: "pointer", textDecoration: "none",
});

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketingCalendarPage() {
  const currentYear = new Date().getFullYear();

  const [year, setYear]   = useState(currentYear);
  const [data, setData]   = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (y: number) => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${BOT_URL}/admin/marketing-calendar/plan?year=${y}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (e: any) {
      setError(e?.message ?? "Could not reach the marketing calendar API.");
      setData(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(year); }, [year, load]);

  const setStatus = async (row: PlanRow, status: PlanStatus) => {
    setBusyId(row.id);
    try {
      const r = await fetch(`${BOT_URL}/admin/marketing-calendar/plan/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setData(prev => prev && ({ ...prev, rows: prev.rows.map(x => x.id === row.id ? { ...x, status } : x) }));
    } catch (e: any) {
      setError(e?.message ?? "Could not update that sale.");
    } finally { setBusyId(null); }
  };

  const rollForward = async () => {
    setRolling(true); setError(null); setNotice(null);
    try {
      const r = await fetch(`${BOT_URL}/admin/marketing-calendar/roll-forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromYear: year, toYear: year + 1 }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      const skipped = d.skipped?.length
        ? ` ${d.skipped.length} one-off${d.skipped.length === 1 ? "" : "s"} not carried over.`
        : "";
      setNotice(`Built ${d.created?.length ?? 0} sales for ${year + 1}, every date recomputed from its anchor.${skipped}`);
    } catch (e: any) {
      setError(e?.message ?? "Roll-forward failed.");
    } finally { setRolling(false); }
  };

  /** Grouped by month, undated last — those are the ones needing a human. */
  const grouped = useMemo(() => {
    if (!data) return [];
    const buckets = new Map<string, PlanRow[]>();
    for (const row of data.rows) {
      const key = row.start_date ? row.start_date.slice(0, 7) : "undated";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(row);
    }
    return [...buckets.entries()].sort(([a], [b]) =>
      a === "undated" ? 1 : b === "undated" ? -1 : a.localeCompare(b));
  }, [data]);

  const due = useMemo(
    () => (data?.rows ?? [])
      .filter(r => {
        const d = daysUntil(r.start_date);
        return d !== null && d >= 0 && d <= 21 && (r.status === "planned" || r.status === "briefed");
      })
      .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? "")),
    [data],
  );

  const hasPlan = !!data && data.rows.length > 0;

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <CalendarDays size={16} color={ACCENT} />
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#e2e8f0" }}>Sales calendar</h2>
          <div style={{ display: "flex", gap: "0.25rem", marginLeft: "0.5rem" }}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <button key={y} onClick={() => setYear(y)} style={{
                ...btn(y === year), padding: "0.25rem 0.6rem", fontSize: 10.5,
              }}>{y}</button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <button onClick={() => void load(year)} style={btn()} disabled={loading}>
            <RefreshCw size={12} className={loading ? "spin" : ""} /> Refresh
          </button>
          <button onClick={() => void rollForward()} style={btn()} disabled={rolling || !hasPlan}
            title={`Build ${year + 1} from ${year}, recomputing every floating date`}>
            {rolling ? <Loader2 size={12} /> : <ArrowRightCircle size={12} />} Roll into {year + 1}
          </button>
          <Link href="/marketing/calendar/import" style={btn(true)}>
            <Download size={12} /> Import from sheet
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ ...CARD, marginBottom: "1rem", borderColor: "rgba(244,63,94,0.3)" }}>
          <p style={{ fontSize: 12, color: "#f43f5e" }}>{error}</p>
        </div>
      )}
      {notice && (
        <div style={{ ...CARD, marginBottom: "1rem", borderColor: `${ACCENT}40` }}>
          <p style={{ fontSize: 12, color: ACCENT }}>{notice}</p>
        </div>
      )}

      {/* ── Overlaps. Loud on purpose — see the file header. ───────────────── */}
      {!!data?.overlaps?.length && (
        <div style={{
          ...CARD, marginBottom: "1.25rem",
          background: "rgba(244,63,94,0.06)", borderColor: "rgba(244,63,94,0.28)",
        }}>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
            <AlertTriangle size={15} color="#f43f5e" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontSize: 12.5, fontWeight: 800, color: "#f43f5e", marginBottom: "0.35rem" }}>
                {data.overlaps.length} overlapping sale{data.overlaps.length === 1 ? "" : "s"}
              </p>
              <p style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.6, marginBottom: "0.5rem" }}>
                The theme takes the <strong>first</strong> matching event and stops looking. Two sales
                covering the same day is not an error on the site — the second one silently never
                renders, and which one wins is decided by its position in the Shopify list.
              </p>
              {data.overlaps.map((o, i) => (
                <p key={i} style={{ fontSize: 11.5, color: "#cbd5e1", lineHeight: 1.7 }}>
                  • <strong>{o.a.title}</strong> and <strong>{o.b.title}</strong> share {o.days} day{o.days === 1 ? "" : "s"}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── The nag ────────────────────────────────────────────────────────── */}
      {!!due.length && (
        <Panel
          title={`${due.length} sale${due.length === 1 ? "" : "s"} starting soon without assets`}
          note="Inside 21 days and still 'planned' or 'briefed'. A 4K plate alone takes minutes to render; the copy, the pick, the Shopify paste and the discount code all happen after it."
        >
          {due.map(row => {
            const d = daysUntil(row.start_date)!;
            return (
              <div key={row.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: "1rem", padding: "0.5rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: "#e2e8f0" }}>{row.title}</p>
                  <p style={{ fontSize: 11, color: "#64748b" }}>
                    {range(row)} · {d === 0 ? "starts today" : d === 1 ? "starts tomorrow" : `in ${d} days`}
                    {row.offer ? ` · ${row.offer}` : ""}
                  </p>
                </div>
                {/* A plain anchor, not <Link>: the studio reads ?planId on mount from
                    window.location (it avoids useSearchParams, which would drop that
                    route's static prerender), so it needs a real navigation. */}
                <a href={`/marketing/promotions?planId=${row.id}`} style={{ ...btn(true), flexShrink: 0 }}>
                  <Sparkles size={12} /> Brief it
                </a>
              </div>
            );
          })}
        </Panel>
      )}

      {/* ── The plan ───────────────────────────────────────────────────────── */}
      {loading && !data && (
        <div style={{ ...CARD, textAlign: "center", padding: "2rem" }}>
          <Loader2 size={18} color={ACCENT} />
          <p style={{ fontSize: 12, color: "#64748b", marginTop: "0.5rem" }}>Reading the plan…</p>
        </div>
      )}

      {!loading && !hasPlan && !error && (
        <Panel title={`${year} calendar`}>
          <EmptyState
            reason={
              `Nothing planned for ${year} yet. The company marketing calendar lives in a Google ` +
              `Sheet — import it once and it becomes a plan here, with every recurring sale ` +
              `rolling itself forward from then on.`
            }
            action={
              <Link href="/marketing/calendar/import" style={btn(true)}>
                <Download size={12} /> Import from the sheet
              </Link>
            }
          />
        </Panel>
      )}

      {hasPlan && (
        <>
          <div style={{ display: "flex", gap: "1.25rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            {[
              { label: "Sales", value: data!.counts.total },
              { label: "Upcoming", value: data!.counts.upcoming },
              { label: "Need assets", value: data!.counts.unready },
              { label: "Undated", value: data!.counts.undated },
            ].map(s => (
              <div key={s.label}>
                <p style={{ fontSize: 19, fontWeight: 800, color: s.value && s.label !== "Sales" && s.label !== "Upcoming" ? ACCENT : "#e2e8f0" }}>{s.value}</p>
                <p style={{ ...LABEL, fontSize: 9.5 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {grouped.map(([key, rows]) => (
            <div key={key} style={{ marginBottom: "1.25rem" }}>
              <p style={{ ...LABEL, marginBottom: "0.5rem" }}>
                {key === "undated"
                  ? "No dates — needs a human"
                  : `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`}
              </p>

              <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
                {rows.map((row, i) => {
                  const open = expanded === row.id;
                  const d = daysUntil(row.start_date);
                  return (
                    <div key={row.id} style={{ borderTop: i ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                      <div
                        onClick={() => setExpanded(open ? null : row.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: "0.85rem",
                          padding: "0.7rem 0.9rem", cursor: "pointer",
                        }}
                      >
                        <ChevronRight size={13} color="#475569" style={{
                          flexShrink: 0, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s",
                        }} />

                        <div style={{ width: 110, flexShrink: 0 }}>
                          <p style={{ fontSize: 11.5, color: "#cbd5e1", fontWeight: 700 }}>{range(row)}</p>
                          {d !== null && d >= 0 && d <= 45 && (
                            <p style={{ fontSize: 10, color: d <= 21 ? ACCENT : "#475569" }}>
                              <Clock size={9} style={{ display: "inline", marginRight: 3 }} />
                              {d === 0 ? "today" : `${d}d`}
                            </p>
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12.5, fontWeight: 700, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.title}
                          </p>
                          <p style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.offer ?? "no offer set"}
                            {row.promo_code ? ` · ${row.promo_code}` : ""}
                          </p>
                        </div>

                        {row.date_confidence === "ambiguous" && (
                          <AlertTriangle size={12} color="#eab308" />
                        )}
                        <StatusPill status={row.status} />
                      </div>

                      {open && (
                        <div style={{ padding: "0 0.9rem 0.9rem 2.5rem", display: "grid", gap: "0.7rem" }}>
                          {row.angle && (
                            <p style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.6, fontStyle: "italic" }}>
                              {row.angle}
                            </p>
                          )}
                          {row.discount_note && (
                            <div>
                              <p style={{ ...LABEL, fontSize: 9 }}>Fine print</p>
                              <p style={{ fontSize: 11.5, color: "#cbd5e1", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                                {row.discount_note}
                              </p>
                            </div>
                          )}
                          {row.notes && (
                            <p style={{ fontSize: 11.5, color: "#eab308", lineHeight: 1.6 }}>{row.notes}</p>
                          )}

                          {/* Provenance. "The sheet said X" and "we computed Y for this year"
                              are different claims, and only one of them is checkable. */}
                          <p style={{ fontSize: 10.5, color: "#475569", lineHeight: 1.6 }}>
                            Sheet said “{row.source_date_text || "—"}”
                            {row.source_year ? ` (written for ${row.source_year})` : ""} ·
                            {" "}{row.recurrence.replace("_", " ")} · dates {row.date_confidence}
                          </p>

                          {!!Object.keys(row.channel_notes ?? {}).length && (
                            <details>
                              <summary style={{ ...LABEL, fontSize: 9, cursor: "pointer" }}>
                                Other channels ({Object.keys(row.channel_notes).length})
                              </summary>
                              <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.4rem" }}>
                                {Object.entries(row.channel_notes).map(([k, v]) => (
                                  <div key={k}>
                                    <p style={{ fontSize: 9.5, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>{k}</p>
                                    <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{v}</p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}

                          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                            <a href={`/marketing/promotions?planId=${row.id}`} style={btn(true)}>
                              <Sparkles size={12} /> Brief it in the Studio
                            </a>

                            <select
                              value={row.status}
                              disabled={busyId === row.id}
                              onChange={e => void setStatus(row, e.target.value as PlanStatus)}
                              style={{
                                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 8, padding: "0.35rem 0.6rem", color: "#94a3b8", fontSize: 11,
                              }}
                            >
                              {STATUS_ORDER.map(s => (
                                <option key={s} value={s} style={{ background: "#0f172a" }}>{STATUS[s].label}</option>
                              ))}
                            </select>

                            {!!row.studio_job_ids?.length && (
                              <span style={{ fontSize: 10.5, color: "#4ade80", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Check size={11} /> {row.studio_job_ids.length} studio run{row.studio_job_ids.length === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* The honest limit of this page, stated where somebody will read it. */}
          <p style={{ fontSize: 10.5, color: "#475569", lineHeight: 1.7, marginTop: "1.5rem" }}>
            Publishing is still manual. Three of the five hero slots have no field on the
            Shopify <code>marketing_event</code> metaobject yet, so assets are generated here,
            downloaded, and pasted into the admin by hand.
            {" "}
            <a href="https://admin.shopify.com/store/leaps-rebounds/content/metaobjects/entries/marketing_event"
              target="_blank" rel="noreferrer" style={{ color: ACCENT }}>
              Shopify events <ExternalLink size={9} style={{ display: "inline" }} />
            </a>
          </p>
        </>
      )}

      <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
